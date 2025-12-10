import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import "@/lib/firebaseAdmin";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Endpoint para procesar transacciones por voz
 * 1. Recibe audio del micrófono
 * 2. Transcribe el audio usando Gemini
 * 3. Extrae datos estructurados (monto, descripción, categoría, tipo)
 * 4. Guarda la transacción automáticamente
 */

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

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

    // 📝 Log para debug: ver tipo de archivo recibido
    console.log(`[Voice] Archivo recibido: ${audioFile.name}, tipo: ${audioFile.type}, tamaño: ${audioFile.size} bytes`);

    // 🗣️ PASO 1: Transcribir el audio usando Gemini nativo
    console.log(`[Voice] Transcribiendo audio con Gemini para usuario ${userId}...`);
    
    let transcription = "";
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      // Determinar el MIME type correcto según documentación oficial de Gemini
      // Soportados: WAV, MP3, AIFF, AAC, OGG Vorbis, FLAC
      let mimeType = audioFile.type;
      
      // Si no viene el tipo o es genérico, inferir del nombre
      if (!mimeType || mimeType === 'application/octet-stream') {
        if (audioFile.name.endsWith('.wav')) {
          mimeType = 'audio/wav'; // ✅ SOPORTADO
        } else if (audioFile.name.endsWith('.mp3')) {
          mimeType = 'audio/mp3'; // ✅ SOPORTADO
        } else if (audioFile.name.endsWith('.m4a') || audioFile.name.endsWith('.aac')) {
          mimeType = 'audio/aac'; // ✅ SOPORTADO (AAC)
        } else if (audioFile.name.endsWith('.flac')) {
          mimeType = 'audio/flac'; // ✅ SOPORTADO
        } else if (audioFile.name.endsWith('.ogg')) {
          mimeType = 'audio/ogg'; // ✅ SOPORTADO (OGG Vorbis)
        } else if (audioFile.name.endsWith('.aiff')) {
          mimeType = 'audio/aiff'; // ✅ SOPORTADO
        } else {
          mimeType = 'audio/wav'; // Default a WAV
        }
      } else if (mimeType === 'audio/m4a' || mimeType === 'audio/mp4') {
        mimeType = 'audio/aac'; // Normalizar m4a/mp4 a AAC
      }

      console.log(`[Voice] Usando modelo: gemini-2.5-flash, MIME type: ${mimeType}, tamaño: ${audioFile.size} bytes`);

      const result = await model.generateContent([
        {
          inlineData: {
            data: buffer.toString("base64"),
            mimeType,
          },
        },
        `Transcribe este audio al español de Perú palabra por palabra.

Reglas:
1. Si el audio está vacío, en blanco o tiene ruido excesivo sin voz humana clara, responde SOLO "AUDIO_INVALIDO"
2. Si detectas voz pero está muy distorsionada o inaudible, responde "AUDIO_INAUDIBLE"
3. Si detectas voz clara, devuelve SOLO el texto transcrito exacto sin agregar puntos, comas ni explicaciones
4. No inventes palabras si no las escuchas claramente
5. Mantén el texto en minúsculas salvo nombres propios`,
      ]);

      transcription = result.response.text().trim();
      console.log(`[Voice] ✅ Transcripción exitosa: "${transcription}" (${transcription.length} caracteres)`);

      // Validación estricta de transcripción
      const invalidTranscriptions = [
        'AUDIO_INVALIDO', 
        'AUDIO_INAUDIBLE', 
        '.', 
        'Eh.', 
        'y', 
        'eh',
        'mm',
        'uh',
        'ah'
      ];
      
      if (invalidTranscriptions.includes(transcription) || transcription.length < 5) {
        console.error(`[Voice] ❌ Transcripción inválida o muy corta: "${transcription}"`);
        return NextResponse.json(
          { 
            error: "No se detectó voz clara en el audio.\n\nConsejos:\n✓ Habla cerca del micrófono (5-10 cm)\n✓ Habla despacio y con claridad\n✓ Evita ruido de fondo\n✓ Mantén presionado el botón mientras hablas\n✓ Graba mínimo 2-3 segundos\n✓ Verifica los permisos de micrófono",
            transcription,
            debug: {
              audioSize: audioFile.size,
              mimeType,
              model: "gemini-2.5-flash",
              transcriptionLength: transcription.length
            }
          },
          { status: 400 }
        );
      }
    } catch (transcriptionError) {
      console.error("[Voice] ❌ Error en transcripción:", transcriptionError);
      return NextResponse.json(
        { 
          error: "Error al transcribir el audio. Verifica que el archivo sea válido.",
          details: transcriptionError instanceof Error ? transcriptionError.message : "Unknown error"
        },
        { status: 500 }
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
      // ✅ USAR GEMINI en lugar de OpenAI
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      
      const result = await model.generateContent([
        systemPrompt,
        `\nTexto a analizar: "${transcription}"`
      ]);

      const aiResponse = result.response.text().trim();
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

      // Intento de recuperación con Gemini
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const recoveryResult = await model.generateContent([
          `Del siguiente texto extraído por voz: "${transcription}"
          
Devuelve SOLO un JSON válido con esta estructura exacta (sin markdown, sin explicaciones):
{
  "type": "expense",
  "amount": 50.00,
  "description": "comida",
  "categoryName": "Alimentación"
}

Si no puedes extraer algún dato, usa valores por defecto razonables.`
        ]);

        const recoveryText = recoveryResult.response.text().trim();
        console.log(`[Voice] Recuperación IA: ${recoveryText}`);
        
        const jsonMatch2 = recoveryText.match(/\{[\s\S]*\}/);
        const jsonString2 = jsonMatch2 ? jsonMatch2[0] : recoveryText;
        parsedData = JSON.parse(jsonString2);

        // Validaciones básicas de nuevo
        if (!parsedData.type || !parsedData.amount || parsedData.amount <= 0) {
          console.error("[Voice] Recuperación fallida: datos inválidos", parsedData);
          return NextResponse.json(
            {
              error: "No se pudo procesar la información después de intentar recuperarla.",
              transcription,
              debug: parseError instanceof Error ? parseError.message : String(parseError),
            },
            { status: 400 }
          );
        }

        if (!["expense", "income"].includes(parsedData.type)) {
          parsedData.type = "expense";
        }

      } catch (recoveryError) {
        console.error("[Voice] Fallback parse failed:", recoveryError);
        return NextResponse.json(
          {
            error: "No se pudo procesar la información. Intenta ser más específico.",
            transcription,
            debug: parseError instanceof Error ? parseError.message : String(parseError),
          },
          { status: 400 }
        );
      }
    }

    // 🔍 PASO 3: Buscar la categoría en la base de datos
    let categoryId: string | null = null;

    if (parsedData.categoryName) {
      console.log(`[Voice] 🔍 Buscando categoría: "${parsedData.categoryName}"`);
      
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
    } else {
      console.log(`[Voice] ⚠️ No se especificó categoría en el audio`);
    }

    // 💾 PASO 4: Crear la transacción (reutilizando lógica de /api/transactions)
    console.log(`[Voice] 💾 Creando transacción: ${parsedData.type}, monto: ${parsedData.amount}`);

    // Ajustar el monto: negativo para expense, positivo para income
    const signedAmount = parsedData.type === "expense"
      ? -Math.abs(parsedData.amount)
      : Math.abs(parsedData.amount);

    // Buscar o crear cuenta principal
    let account = await prisma.account.findFirst({ where: { userId } });
    if (!account) {
      account = await prisma.account.create({
        data: { userId, name: "Cuenta principal", balance: 0, currency: "PEN" },
      });
    }

    // Calcular nuevo saldo
    let newBalance = new Decimal(account.balance).plus(signedAmount);

    // Crear transacción
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        accountId: account.id,
        type: parsedData.type,
        amount: signedAmount, // monto negativo o positivo
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
        model: "gemini-2.5-flash", // Modelo usado para transcripción
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
