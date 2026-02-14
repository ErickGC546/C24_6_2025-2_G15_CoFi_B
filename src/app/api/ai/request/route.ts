import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";
import OpenAI from "openai";

// Minimal, easy-to-read handler that: verifies Firebase token, validates messages,
// calls Groq via the `openai` SDK, and saves aiUsage + credit transaction.

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const body = await req.json();
    // Support single `userMessage` or multiple `userMessages`
    let messages: string[] = [];
    if (typeof body.userMessage === "string") messages.push(body.userMessage);
    if (Array.isArray(body.userMessages)) messages = messages.concat(body.userMessages.filter((m: unknown) => typeof m === "string"));

    if (messages.length === 0) {
      return NextResponse.json({ error: "Falta el/los mensaje(s) del usuario" }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      console.error("[AI] missing GROQ_API_KEY");
      return NextResponse.json({ error: "Falta la configuración del proveedor de IA (GROQ_API_KEY)." }, { status: 500 });
    }

    // Verify user and credits
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
    const creditsNeeded = messages.length;
    if (user.aiCreditsRemaining < creditsNeeded) {
      return NextResponse.json({ error: "No tienes créditos de IA suficientes" }, { status: 402 });
    }

    const modelName = "llama-3.3-70b-versatile";

    // Call provider for each message (simple, no retries)
    const results: Array<{ input: string; outputText: string | null; raw: unknown }> = [];
    for (const m of messages) {
      const res = await client.chat.completions.create({
        model: modelName,
        messages: [
          { role: "system", content: "Eres 'CoFiasistente', un asistente experto en finanzas personales diseñado **exclusivamente para estudiantes** universitarios y de educación superior. Tu objetivo principal es ayudar a los usuarios a navegar la vida financiera estudiantil con confianza. Debes ser: \n\n1. **Práctico y Accesible:** Usa un lenguaje claro, motivacional y libre de jerga financiera compleja. Ofrece pasos de acción concretos y planes de presupuesto realistas.\n+2.  **Consejero y Educador:** No solo des presupuestos, sino que también educa sobre el valor del ahorro, la deuda responsable y la inversión inicial. \n3.  **Imparcial:** Nunca ofrezcas consejo de inversión específica (ej. comprar una acción), solo principios generales." },
          { role: "user", content: m },
        ],
      });

      // Try to extract text from common response shapes without using `any`
      let text: string | null = null;
      try {
        const obj = res as unknown;
        if (isRecord(obj) && Array.isArray(obj.choices)) {
          const choice = obj.choices[0];
          if (isRecord(choice)) {
            const message = choice.message;
            if (isRecord(message) && typeof message.content === "string") {
              text = message.content;
            } else if (typeof choice.text === "string") {
              text = choice.text as string;
            } else if (Array.isArray(choice.content)) {
              text = choice.content
                .map((c: unknown) => {
                  if (typeof c === "string") return c;
                  if (isRecord(c) && typeof c.text === "string") return c.text;
                  return JSON.stringify(c);
                })
                .join("\n");
            }
          }
        }
      } catch {
        text = null;
      }

      results.push({ input: m, outputText: text, raw: res });
    }

    // If any result is missing text, return a friendly error (no charges applied)
    const missing = results.filter((r) => !r.outputText);
    if (missing.length > 0) {
      console.error("AI provider returned incomplete results", missing.map((m) => m.input));
      return NextResponse.json({ error: "El servicio de IA no devolvió respuesta válida. Intenta nuevamente en unos segundos." }, { status: 502 });
    }

    // Persist usages and update credits in a single transaction
    await prisma.$transaction(async (tx) => {
      const freshUser = await tx.user.findUnique({ where: { id: userId } });
      if (!freshUser) throw new Error("Usuario no encontrado");
      if (freshUser.aiCreditsRemaining < creditsNeeded) throw new Error("No tienes créditos de IA suficientes");

      for (const r of results) {
        await tx.aiUsage.create({
          data: {
            userId,
            provider: "groq",
            requestType: "advice",
            model: modelName,
            tokensIn: 0,
            tokensOut: 0,
            tokensTotal: 0,
            creditsCharged: 1,
            inputJson: { userMessage: r.input },
            outputJson: { message: r.outputText, raw: JSON.parse(JSON.stringify(r.raw)) },
          },
        });
      }

      const balanceAfter = freshUser.aiCreditsRemaining - creditsNeeded;
      await tx.aiCreditsTransaction.create({
        data: {
          userId: freshUser.id,
          change: -creditsNeeded,
          balanceAfter,
          reason: creditsNeeded > 1 ? "ai_request_batch" : "ai_request",
          source: "groq",
        },
      });

      await tx.user.update({
        where: { id: freshUser.id },
        data: { aiCreditsRemaining: { decrement: creditsNeeded }, aiTotalConsumed: { increment: BigInt(creditsNeeded) } },
      });
    });

    // Return responses: single string if one message, array otherwise
    if (results.length === 1) return NextResponse.json({ response: results[0].outputText });
    return NextResponse.json({ response: results.map((r) => r.outputText) });
  } catch (err: unknown) {
    console.error("Error en /api/ai/request:", err);
    return NextResponse.json({ error: "Error interno en la IA" }, { status: 500 });
  }
}
