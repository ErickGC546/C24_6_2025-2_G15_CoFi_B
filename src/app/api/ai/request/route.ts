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

    const body = await req.json();
    const requestType = body.requestType ?? "advice";

    // Soportar un único mensaje (userMessage) o múltiples (userMessages: string[])
    let messages: string[] = [];
    if (typeof body.userMessage === "string") messages.push(body.userMessage);
    if (Array.isArray(body.userMessages)) messages = messages.concat(body.userMessages.filter((m: unknown) => typeof m === "string"));

    if (messages.length === 0) {
      return NextResponse.json({ error: "Falta el/los mensaje(s) del usuario" }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usageSum = await prisma.aiUsage.aggregate({
      _sum: { creditsCharged: true },
      where: {
        userId,
        createdAt: { gte: today },
      },
    });

    const creditsUsedToday = usageSum._sum?.creditsCharged ?? 0;
    const DAILY_LIMIT = 5; // límite diario por usuario (ajustable)

    if (creditsUsedToday >= DAILY_LIMIT) {
      return NextResponse.json({ error: `Has alcanzado el límite diario de ${DAILY_LIMIT} consultas de IA` }, { status: 403 });
    }

    const idempoKey = req.headers.get("x-idempotency-key");
    if (idempoKey) {
      try {
        const existing = await prisma.aiUsage.findFirst({
          where: {
            userId,
            inputJson: { path: ["idempotencyKey"], equals: idempoKey },
          },
          orderBy: { createdAt: "desc" },
        });
        if (existing) {
          // Normalizar la salida a texto si es posible
          const normalize = (out: any) => {
                  try {
                    if (!out) return null;
                    if (typeof out === "string") return out;
                    if (out.message && typeof out.message === "string") return out.message;
                    if (out.outputText && typeof out.outputText === "string") return out.outputText;
                    // Si es un objeto con raw/message
                    if (out.raw) {
                      // intentar extraer texto de estructuras comunes
                      if (typeof out.raw === "string") return out.raw;
                      if (out.raw.choices && Array.isArray(out.raw.choices) && out.raw.choices[0]) {
                        const c = out.raw.choices[0];
                        if (c.message && c.message.content) return c.message.content;
                        if (c.text) return c.text;
                      }
                    }
                    return null;
                  } catch (e) {
                    return null;
                  }
                };
          const norm = normalize(existing.outputJson);
          // Debug log: idempotency hit
          try {
            console.log("[AI] idempotency hit for user", userId, "key", idempoKey, "normalizedResponseExists", !!norm);
            console.log("[AI] existing.outputJson (truncated):", JSON.stringify(existing.outputJson)?.slice(0, 1000));
          } catch (e) {
            /* ignore logging errors */
          }
          return NextResponse.json({ response: norm ?? "No se recibió respuesta de la IA." });
        }
      } catch (err: unknown) {
        console.warn("Idempotency check failed, continuing:", err);
      }
    }

    // Si es una sola consulta, intentar deduplicación rápida por mensaje en los últimos 10s
    if (messages.length === 1) {
      try {
        const tenSecondsAgo = new Date(Date.now() - 10 * 1000);
        const recent = await prisma.aiUsage.findFirst({
          where: {
            userId,
            createdAt: { gte: tenSecondsAgo },
            inputJson: { path: ["userMessage"], equals: messages[0] },
          },
          orderBy: { createdAt: "desc" },
        });

        if (recent) {
          return NextResponse.json({ response: recent.outputJson ?? "No se recibió respuesta de la IA." });
        }
      } catch (err: unknown) {
        console.warn("Dedup check failed, continuing:", err);
      }
    }

    // Verificar créditos disponibles antes de llamar al proveedor
    const creditsToCharge = messages.length;
    const userRecord = await prisma.user.findUnique({ where: { id: userId } });
    if (!userRecord) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
    if (userRecord.aiCreditsRemaining < creditsToCharge) {
      return NextResponse.json({ error: "No tienes créditos de IA suficientes" }, { status: 402 });
    }

    // Llamar al proveedor por cada mensaje y recolectar respuestas. No grabamos nada hasta que todas las respuestas sean válidas.
    const modelName = "google/gemini-2.0-flash-exp:free";

    const extractText = (data: any) => {
      // Intentar varias rutas comunes para extraer texto
      try {
        if (!data) return null;
        if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
          const c = data.choices[0];
          if (c.message && (c.message.content || c.message?.content)) return c.message.content || c.message?.content;
          if (typeof c.content === "string") return c.content;
          // algunas APIs retornan content como array
          if (Array.isArray(c.content) && c.content.length > 0) {
            if (typeof c.content[0] === "string") return c.content[0];
            if (c.content[0].text) return c.content[0].text;
          }
          if (c.text) return c.text;
        }
        if (data.output && Array.isArray(data.output) && data.output.length > 0) {
          const o0 = data.output[0];
          if (o0.content && Array.isArray(o0.content) && o0.content.length > 0) {
            return o0.content.map((p: any) => p.text || p).join("\n");
          }
        }
        // Fallbacks:
        if (typeof data === "string") return data;
        if (data.message && typeof data.message === "string") return data.message;
        return null;
      } catch (err) {
        console.warn("extractText error", err);
        return null;
      }
    };

    const aiResults: Array<{ input: string; outputRaw: any; outputText: string | null; ok: boolean; status?: number }> = [];

    for (const m of messages) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: "system",
              content: "Eres un asistente financiero inteligente que analiza presupuestos, gastos e ingresos y ofrece consejos claros y útiles para mejorar las finanzas personales para estudiantes."
            },
            { role: "user", content: m }
          ],
        }),
      });

      let parsed: any = null;
      try {
        parsed = await res.json();
      } catch (err) {
        parsed = null;
      }

      // Debug: log provider response summary (truncated)
      try {
        console.log('[AI] provider response status=', res.status, 'for input truncated:', m?.slice?.(0,100));
        console.log('[AI] provider parsed (truncated):', JSON.stringify(parsed)?.slice(0,2000));
      } catch (e) {
        /* ignore logging errors */
      }

      const text = extractText(parsed) || null;
      aiResults.push({ input: m, outputRaw: parsed, outputText: text, ok: !!text, status: res.status });
    }

    // Si alguna de las consultas no devolvió texto útil, no cobramos y devolvemos error al cliente
    const failed = aiResults.filter(r => !r.ok);
    if (failed.length > 0) {
      console.error("AI provider returned incomplete results", failed.map(f => ({ status: f.status, input: f.input })));
      // adicional logging para diagnostico
      try {
        console.log('[AI] aiResults (truncated):', JSON.stringify(aiResults)?.slice(0,2000));
      } catch (e) {}
      return NextResponse.json({ error: "El proveedor de IA no devolvió respuesta válida para una o más consultas" }, { status: 502 });
    }

    // Guardar todas las entradas en una transacción atómica: múltiples AiUsage, una AiCreditsTransaction y actualizar saldo del usuario.
    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error("Usuario no encontrado");
        if (user.aiCreditsRemaining < creditsToCharge) {
          throw new Error("No tienes créditos de IA suficientes");
        }

        // Crear usos individuales
        for (let i = 0; i < aiResults.length; i++) {
          const r = aiResults[i];
          await tx.aiUsage.create({
            data: {
              userId,
              provider: "openrouter",
              requestType,
              model: modelName,
              tokensIn: 0,
              tokensOut: 0,
              tokensTotal: 0,
              creditsCharged: 1,
              inputJson: { userMessage: r.input, ...(idempoKey ? { idempotencyKey: idempoKey } : {}) },
              outputJson: { message: r.outputText, raw: r.outputRaw },
            },
          });
        }

        const balanceAfter = user.aiCreditsRemaining - creditsToCharge;
        await tx.aiCreditsTransaction.create({
          data: {
            userId: user.id,
            change: -creditsToCharge,
            balanceAfter,
            reason: creditsToCharge > 1 ? "ai_request_batch" : "ai_request",
            source: "openrouter",
          },
        });

        await tx.user.update({
          where: { id: user.id },
          data: {
            aiCreditsRemaining: { decrement: creditsToCharge },
            aiTotalConsumed: { increment: BigInt(creditsToCharge) },
          },
        });
      });

      // Debug: log success
      try { console.log('[AI] success aiResults (truncated):', JSON.stringify(aiResults)?.slice(0,2000)); } catch (e) {}
      // Devolver respuestas: si fue una sola consulta, devolver string; si múltiples, array
      if (aiResults.length === 1) {
        return NextResponse.json({ response: aiResults[0].outputText });
      }
      return NextResponse.json({ response: aiResults.map(r => r.outputText) });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("No tienes créditos")) {
        return NextResponse.json({ error: "No tienes créditos de IA suficientes" }, { status: 402 });
      }
      throw err;
    }
  } catch (error) {
    console.error("Error en /api/ai/request:", error);
    return NextResponse.json({ error: "Error interno en la IA" }, { status: 500 });
  }
}
