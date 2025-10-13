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

    const usageSum = await prisma.aiUsage.aggregate({
      _sum: { creditsCharged: true },
      where: {
        userId,
        createdAt: { gte: today },
      },
    });

    const creditsUsedToday = usageSum._sum?.creditsCharged ?? 0;

    if (creditsUsedToday >= 3) {
      return NextResponse.json({
        error: "Has alcanzado el límite diario de 3 consultas de IA",
      }, { status: 403 });
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
          let resp = "No se recibió respuesta de la IA.";
          const out = existing.outputJson;
          if (out && typeof out === "object" && !Array.isArray(out) && "message" in out) {
            // @ts-ignore access dynamic JSON
            resp = (out as Record<string, any>).message ?? resp;
          } else if (typeof out === "string") {
            resp = out;
          }
          return NextResponse.json({ response: resp });
        }
      } catch (e) {
        console.warn("Idempotency check failed, continuing:", e);
      }
    }

    try {
      const tenSecondsAgo = new Date(Date.now() - 10 * 1000);
      const recent = await prisma.aiUsage.findFirst({
        where: {
          userId,
          createdAt: { gte: tenSecondsAgo },
          inputJson: { path: ["userMessage"], equals: userMessage },
        },
        orderBy: { createdAt: "desc" },
      });

      if (recent) {
        // Si encontramos una entrada reciente con el mismo mensaje, devolvemos su respuesta y no creamos nada nuevo.
        let resp = "No se recibió respuesta de la IA.";
        const out = recent.outputJson;
        if (out && typeof out === "object" && !Array.isArray(out) && "message" in out) {
          // @ts-ignore access dynamic JSON
          resp = (out as Record<string, any>).message ?? resp;
        } else if (typeof out === "string") {
          resp = out;
        }
        return NextResponse.json({ response: resp });
      }
    } catch (e) {
      // Si el proveedor de la base de datos no soporta consultas JSON comparativas, ignoramos la deduplicación y seguimos.
      console.warn("Dedup check failed, continuing:", e);
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
            content: "Eres un asistente financiero inteligente que analiza presupuestos, gastos e ingresos y ofrece consejos claros y útiles para mejorar las finanzas personales para estudiantes."
          },
          { role: "user", content: userMessage }
        ],
      }),
    });

    const data = await aiResponse.json();
    const message = data?.choices?.[0]?.message?.content || "No se recibió respuesta de la IA.";

    // 🧾 Guardar en la base de datos en una transacción atómica: crear AiUsage, crear AiCreditsTransaction y actualizar saldo del usuario.
    const creditsToCharge = 1;
    try {
      const usage = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error("Usuario no encontrado");
        if (user.aiCreditsRemaining < creditsToCharge) {
          throw new Error("No tienes créditos de IA suficientes");
        }

        const created = await tx.aiUsage.create({
          data: {
            userId,
            provider: "openrouter",
            requestType,
            model: "google/gemini-2.0-flash-exp:free",
            tokensIn: 0,
            tokensOut: 0,
            tokensTotal: 0,
            creditsCharged: creditsToCharge,
            inputJson: { userMessage, ...(idempoKey ? { idempotencyKey: idempoKey } : {}) },
            outputJson: { message },
          },
        });

        const balanceAfter = user.aiCreditsRemaining - creditsToCharge;
        await tx.aiCreditsTransaction.create({
          data: {
            userId: user.id,
            change: -creditsToCharge,
            balanceAfter,
            reason: "ai_request",
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

        return created;
      });

      return NextResponse.json({ response: message });
    } catch (e: any) {
      if (e.message && e.message.includes("No tienes créditos")) {
        return NextResponse.json({ error: "No tienes créditos de IA suficientes" }, { status: 402 });
      }
      throw e;
    }
  } catch (error) {
    console.error("Error en /api/ai/request:", error);
    return NextResponse.json({ error: "Error interno en la IA" }, { status: 500 });
  }
}
