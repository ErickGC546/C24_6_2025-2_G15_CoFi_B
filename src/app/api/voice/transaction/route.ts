import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import "@/lib/firebaseAdmin";
import OpenAI from "openai";

/**
 * Endpoint para procesar transacciones por voz
 * 1. Recibe audio del micrófono
 * 2. Transcribe el audio usando Gemini
 * 3. Extrae datos estructurados (monto, descripción, categoría, tipo)
 * 4. Guarda la transacción automáticamente
 */

const client = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

export async function POST(req: Request) {
  try {
    // 🔐 Verificar autenticación
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    // Verificar usuario y créditos de IA
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
    }

    const creditsNeeded = 2; // 1 para transcripción + 1 para parsing
    if (user.aiCreditsRemaining < creditsNeeded) {
      return NextResponse.json(
        { error: "No tienes créditos de IA suficientes para procesar audio" },
        { status: 402 }
      );
    }

    // 🎤 Obtener el archivo de audio del FormData
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "Falta el archivo de audio. Envía el audio como FormData con key 'audio'" },
        { status: 400 }
      );
    }

    // Convertir el archivo a buffer para enviarlo a Gemini
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 🗣️ PASO 1: Transcribir el audio usando Gemini (via OpenAI SDK)
    console.log(`[Voice] Transcribiendo audio para usuario ${userId}...`);
    
    let transcription = "";
    try {
      // Nota: Gemini soporta transcripción de audio a través de la API de OpenAI
      const transcriptionResponse = await client.audio.transcriptions.create({
        file: new File([buffer], audioFile.name || "audio.webm", {
          type: audioFile.type || "audio/webm",
        }),
        model: "whisper-1", // Gemini acepta este formato
        language: "es", // Español
      });

      transcription = transcriptionResponse.text;
      console.log(`[Voice] Transcripción: "${transcription}"`);
    } catch (transcriptionError) {
      console.error("[Voice] Error en transcripción:", transcriptionError);
      return NextResponse.json(
        { error: "Error al transcribir el audio. Intenta de nuevo." },
        { status: 500 }
      );
    }

    if (!transcription || transcription.trim().length === 0) {
      return NextResponse.json(
        { error: "No se pudo detectar audio. Habla más claro o graba de nuevo." },
        { status: 400 }
      );
    }

    // 🧠 PASO 2: Usar IA para extraer datos estructurados
    console.log(`[Voice] Extrayendo datos estructurados de: "${transcription}"`);

    const systemPrompt = `Eres un asistente que procesa transacciones financieras por voz.
El usuario dirá una frase en español y tu trabajo es extraer:
- type: "expense" (gasto) o "income" (ingreso)
- amount: el monto numérico (solo el número, sin símbolos)
- description: descripción de la transacción
- categoryName: nombre de la categoría (usa los nombres EXACTOS de la lista)

Categorías válidas para GASTOS (expense):
- Alimentación (comida, almuerzo, desayuno, cena, restaurante, comida rápida)
- Transporte (taxi, uber, bus, pasaje, movilidad, gasolina, combustible)
- Servicios (internet, celular, recarga, apps, netflix, suscripciones)
- Salud (doctor, farmacia, medicina, hospital, consulta médica)
- Entretenimiento (cine, ocio, juegos, salida, diversión, fiesta)
- Educación (cursos, libros, universidad, colegio, estudios)
- Ropa (ropa, zapatos, vestimenta, ropa deportiva, accesorios)
- Metas (ahorro, meta, inversión)
- tecnologia (tecnología, laptop, celular, gadgets, electrónicos)

Categorías válidas para INGRESOS (income):
- Trabajo (sueldo, salario, nómina, pago de trabajo)
- Vasos (venta de vasos, negocio de vasos)

Reglas importantes:
1. Si el usuario dice "gasté", "compré", "pagué" → type: "expense"
2. Si dice "gané", "cobré", "ingreso", "recibí" → type: "income"
3. Si no especifica, asume "expense" por defecto
4. El monto debe ser un número decimal (ej: 5.50, 100, 770)
5. Si menciona "soles" o "S/" es moneda peruana (PEN)
6. Usa EXACTAMENTE los nombres de categorías de la lista (respeta mayúsculas/minúsculas)
7. Si no estás seguro de la categoría, NO inventes, usa el nombre más cercano de la lista

Responde SOLO con un JSON válido, sin explicaciones:
{
  "type": "expense" | "income",
  "amount": 0.00,
  "description": "texto descriptivo",
  "categoryName": "categoria"
}`;

    let parsedData: {
      type: "expense" | "income";
      amount: number;
      description: string;
      categoryName: string;
    };

    try {
      const completion = await client.chat.completions.create({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcription },
        ],
        temperature: 0.3, // Baja temperatura para respuestas más consistentes
        max_tokens: 200,
      });

      const aiResponse = completion.choices[0]?.message?.content || "{}";
      console.log(`[Voice] Respuesta de IA: ${aiResponse}`);

      // Limpiar la respuesta (a veces la IA incluye markdown)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : aiResponse;

      parsedData = JSON.parse(jsonString);

      // Validaciones básicas
      if (!parsedData.type || !parsedData.amount || parsedData.amount <= 0) {
        throw new Error("Datos incompletos o inválidos");
      }

      // Normalizar type
      if (!["expense", "income"].includes(parsedData.type)) {
        parsedData.type = "expense"; // default
      }

    } catch (parseError) {
      console.error("[Voice] Error al parsear respuesta de IA:", parseError);
      return NextResponse.json(
        {
          error: "No se pudo procesar la información. Intenta ser más específico.",
          transcription,
          debug: parseError instanceof Error ? parseError.message : "Unknown error",
        },
        { status: 400 }
      );
    }

    // 🔍 PASO 3: Buscar la categoría en la base de datos
    let categoryId: string | null = null;

    if (parsedData.categoryName) {
      // Buscar categoría primero en las del usuario, luego en las predeterminadas del sistema
      const category = await prisma.category.findFirst({
        where: {
          OR: [
            // Prioridad 1: Categorías del usuario
            {
              userId,
              name: {
                contains: parsedData.categoryName,
                mode: "insensitive", // case-insensitive
              },
            },
            // Prioridad 2: Categorías predeterminadas del sistema (userId = null)
            {
              userId: null,
              name: {
                contains: parsedData.categoryName,
                mode: "insensitive",
              },
            },
          ],
        },
        orderBy: [
          { userId: "desc" }, // Priorizar categorías del usuario (no null) primero
          { name: "asc" },
        ],
      });

      if (category) {
        categoryId = category.id;
        const categoryType = category.userId ? "personalizada" : "predeterminada";
        console.log(`[Voice] Categoría ${categoryType} encontrada: ${category.name} (${categoryId})`);
      } else {
        console.log(`[Voice] ⚠️ No se encontró categoría "${parsedData.categoryName}" (ni del usuario ni predeterminada)`);
      }
    }

    // 💾 PASO 4: Crear la transacción (reutilizando lógica de /api/transactions)
    
    // Buscar o crear cuenta principal
    let account = await prisma.account.findFirst({ where: { userId } });
    if (!account) {
      account = await prisma.account.create({
        data: { userId, name: "Cuenta principal", balance: 0, currency: "PEN" },
      });
    }

    // Calcular nuevo saldo
    let newBalance = new Decimal(account.balance);
    if (parsedData.type === "expense") {
      newBalance = newBalance.minus(new Decimal(parsedData.amount));
    } else if (parsedData.type === "income") {
      newBalance = newBalance.plus(new Decimal(parsedData.amount));
    }

    // Crear transacción
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        accountId: account.id,
        type: parsedData.type,
        amount: parsedData.amount,
        categoryId,
        note: parsedData.description,
        occurredAt: new Date(),
      },
    });

    // Actualizar saldo de la cuenta
    await prisma.account.update({
      where: { id: account.id },
      data: { balance: newBalance },
    });

    // 📊 PASO 5: Registrar uso de IA y descontar créditos
    const tokensIn = Math.ceil(transcription.length / 4); // aprox 4 chars per token
    const tokensOut = Math.ceil(JSON.stringify(parsedData).length / 4);
    
    await prisma.aiUsage.create({
      data: {
        userId,
        provider: "gemini",
        requestType: "other",
        model: "gemini-2.5-flash",
        tokensIn,
        tokensOut,
        tokensTotal: tokensIn + tokensOut,
        creditsCharged: creditsNeeded,
        costEstimateUsd: 0.01 * creditsNeeded,
        inputJson: { transcription },
        outputJson: parsedData,
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { aiCreditsRemaining: user.aiCreditsRemaining - creditsNeeded },
    });

    // Crear log de auditoría
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: `Creó transacción por voz (${parsedData.type})`,
        detail: {
          transcription,
          parsed: parsedData,
          amount: parsedData.amount,
          categoryId,
        },
      },
    });

    // ✅ PASO 6: Responder con éxito
    console.log(`[Voice] Transacción creada exitosamente: ${transaction.id}`);

    return NextResponse.json({
      success: true,
      message: "✅ Transacción registrada por voz exitosamente",
      transcription,
      parsed: parsedData,
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.note,
        categoryId: transaction.categoryId,
        occurredAt: transaction.occurredAt,
      },
      newBalance: newBalance.toNumber(),
      creditsRemaining: user.aiCreditsRemaining - creditsNeeded,
    });

  } catch (error) {
    console.error("[Voice] Error general en POST /api/voice/transaction:", error);
    return NextResponse.json(
      {
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
