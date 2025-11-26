import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

const MODEL_NAME = "gemini-2.5-pro";

/* 🟢 CREAR NUEVA RECOMENDACIÓN */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const { recType, recSummary: userQuestion, recFull, score } = await req.json();

    // 1) Obtener datos relevantes del usuario (últimas transacciones, ingresos, presupuestos)
    const recentTx = await prisma.transaction.findMany({
      where: { userId, isDeleted: false },
      include: { category: true },
      orderBy: { occurredAt: "desc" },
      take: 50,
    });

    const incomes = await prisma.transaction.findMany({
      where: { userId, type: "income", isDeleted: false },
      orderBy: { occurredAt: "desc" },
      take: 20,
    });

    const budgets = await prisma.budget.findMany({
      where: { userId },
      orderBy: { month: "desc" },
      take: 12,
    });

    // helpers para convertir Decimal a number
    const toNumber = (val: unknown) => {
      try {
        if (val === null || val === undefined) return 0;
        return typeof val === "number" ? val : Number(val);
      } catch {
        return 0;
      }
    };

    const totalExpenses = recentTx
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + toNumber(t.amount), 0);

    const totalIncome = incomes.reduce((s, i) => s + toNumber(i.amount), 0);

    // calcular top categorías simples
    const byCategory: Record<string, number> = {};
    for (const t of recentTx) {
      const cat = t.category?.name ?? "otros";
      byCategory[cat] = (byCategory[cat] || 0) + toNumber(t.amount);
    }
    const topCategories = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amount]) => ({ category, amount }));

    const summary = {
      totals: { totalIncome, totalExpenses },
      topCategories,
      recentTxCount: recentTx.length,
      recentTx: recentTx.slice(0, 10).map((t) => ({
        id: t.id,
        type: t.type,
        amount: toNumber(t.amount),
        category: t.category?.name ?? null,
        note: t.note,
        occurredAt: t.occurredAt,
      })),
      budgets: budgets.map((b) => ({ month: b.month, amount: toNumber(b.amount), categoryId: b.categoryId })),
      userQuestion: userQuestion || "",
    };

    // 2) Llamar a la IA para generar recomendación basada en el resumen
    async function generateAIFeedback(context: typeof summary) {
      const systemPrompt = `Eres 'CoFi asistente', un asistente experto en finanzas personales diseñado **exclusivamente para estudiantes** universitarios y de educación superior integrado en una app de gestión financiera. 

Tienes acceso a los datos reales del usuario en la app (transacciones, ingresos, gastos, categorías, presupuestos).

Tu objetivo: analizar el contexto financiero proporcionado y dar recomendaciones personalizadas, prácticas y motivacionales.

Reglas:
1. **Usa los datos del contexto**: menciona cifras específicas (ingresos totales, gastos por categoría, presupuesto) del usuario.
2. **Sé específico y práctico**: no des consejos genéricos como "usa una app" - el usuario YA está en la app.
3. **Identifica patrones**: señala gastos hormiga, categorías con más gasto, y oportunidades de ahorro.
4. **Motiva y educa**: explica el impacto de cambios pequeños en el ahorro a largo plazo.
5. **Responde en formato JSON** con estas propiedades:
   - recSummary (string): resumen corto de 1-2 líneas con la recomendación principal
   - recFull (string): explicación detallada con datos específicos del usuario y pasos de acción
   - score (number): nivel de urgencia/importancia de 0 a 1`;

      const userPrompt = `Contexto financiero del usuario (últimos datos de la app):
${JSON.stringify(context, null, 2)}

Pregunta del usuario: "${context.userQuestion}"

Analiza los datos y proporciona una recomendación personalizada en formato JSON.`;

      if (!process.env.GEMINI_API_KEY) {
        console.error("[AI] missing GEMINI_API_KEY");
        return {
          recSummary: "Servicio de IA no configurado",
          recFull: "No se pudo generar recomendación personalizada",
          score: 0,
        };
      }

      try {
        const res = await client.chat.completions.create({
          model: MODEL_NAME,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
        });

        const text = res.choices?.[0]?.message?.content;
        if (!text) throw new Error("No response from Gemini");

        // Intentar parsear JSON de la respuesta
        try {
          const parsed = JSON.parse(text);
          return {
            recSummary: parsed.recSummary || text.slice(0, 300),
            recFull: parsed.recFull || text,
            score: typeof parsed.score === "number" ? parsed.score : 0.5,
          };
        } catch {
          // Si no es JSON puro, intentar extraer el primer bloque JSON
          const match = text.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            return {
              recSummary: parsed.recSummary || text.slice(0, 300),
              recFull: parsed.recFull || text,
              score: typeof parsed.score === "number" ? parsed.score : 0.5,
            };
          }
          // Fallback: usar el texto completo
          return {
            recSummary: text.slice(0, 300),
            recFull: text,
            score: 0.5,
          };
        }
      } catch (err) {
        console.error("Error al llamar Gemini:", err);
        // Fallback: plantilla simple con los datos del usuario
        const { totals, topCategories } = context;
        const fallbackSummary = `Con ingresos de ${totals.totalIncome} y gastos de ${totals.totalExpenses}, tu balance es ${
          totals.totalIncome - totals.totalExpenses
        }. Revisa tus gastos en: ${topCategories.map((c: { category: string; amount: number }) => c.category).join(", ")}.`;
        return {
          recSummary: fallbackSummary,
          recFull: `Basado en tus datos: ${JSON.stringify(context, null, 2)}\n\nSugerencia: identifica gastos hormiga y ajusta tu presupuesto en las categorías donde más gastas.`,
          score: 0.5,
        };
      }
    }

    const aiResult = await generateAIFeedback(summary);

    const recommendation = await prisma.aiRecommendation.create({
      data: {
        userId,
        recType,
        recSummary: aiResult.recSummary ?? userQuestion,
        recFull: aiResult.recFull ?? recFull,
        score: aiResult.score ?? score,
        model: MODEL_NAME,
      },
    });

    return NextResponse.json(recommendation);
  } catch (error) {
    console.error("Error en POST /api/ai/recommendations:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* 🟣 OBTENER RECOMENDACIONES DEL USUARIO */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);

    const recommendations = await prisma.aiRecommendation.findMany({
      where: { userId: decoded.uid },
      orderBy: { generatedAt: "desc" },
      take: 10,
    });

    return NextResponse.json(recommendations);
  } catch (error) {
    console.error("Error en GET /api/ai/recommendations:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
