import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const { userMessage, requestType = "advice" } = await req.json();
    if (!userMessage) {
      return NextResponse.json({ error: "Falta el mensaje del usuario" }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usageCount = await prisma.aiUsage.count({
      where: {
        userId,
        createdAt: { gte: today },
      },
    });

    if (usageCount >= 3) {
      return NextResponse.json({
        error: "Has alcanzado el límite diario de 3 consultas de IA",
      }, { status: 403 });
    }

    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp:free",
        messages: [
          {
            role: "system",
            content: "Eres un asistente financiero inteligente que analiza presupuestos, gastos e ingresos y ofrece consejos claros y útiles para mejorar las finanzas personales."
          },
          { role: "user", content: userMessage }
        ],
      }),
    });

    const data = await aiResponse.json();
    const message = data?.choices?.[0]?.message?.content || "No se recibió respuesta de la IA.";

    // 🧾 Guardar en la base de datos
    await prisma.aiUsage.create({
      data: {
        userId,
        provider: "openrouter",
        requestType,
        model: "google/gemini-2.0-flash-exp:free",
        tokensIn: 0,
        tokensOut: 0,
        tokensTotal: 0,
        creditsCharged: 1,
        inputJson: { userMessage },
        outputJson: { message },
      },
    });

    return NextResponse.json({ response: message });
  } catch (error) {
    console.error("Error en /api/ai/request:", error);
    return NextResponse.json({ error: "Error interno en la IA" }, { status: 500 });
  }
}
