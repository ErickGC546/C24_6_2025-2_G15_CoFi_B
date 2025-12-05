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

    const { recType, recSummary: userQuestion, recFull, score, conversationId } = await req.json();

    // Verificar que la conversación existe y pertenece al usuario (si se proporciona)
    if (conversationId) {
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
      });

      if (!conversation) {
        return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
      }
    }

    // 1) Obtener datos relevantes del usuario (últimas transacciones, ingresos, presupuestos)
    const recentTx = await prisma.transaction.findMany({
      where: { userId, isDeleted: false },
      include: { category: true },
      orderBy: { occurredAt: "desc" },
      take: 100, // Más transacciones para mejor análisis
    });

    const incomes = await prisma.transaction.findMany({
      where: { userId, type: "income", isDeleted: false },
      orderBy: { occurredAt: "desc" },
      take: 50,
    });

    const budgets = await prisma.budget.findMany({
      where: { userId },
      orderBy: { month: "desc" },
      take: 12,
    });

    // 🆕 Obtener metas de ahorro individuales
    const personalGoals = await prisma.savingsGoal.findMany({
      where: { 
        userId,
        groupId: null, // solo metas personales
      },
      orderBy: { createdAt: "desc" },
      include: {
        savingsMovements: {
          orderBy: { createdAt: "desc" },
          take: 10, // últimos 10 movimientos por meta
        },
      },
    });

    // 🆕 Obtener metas de ahorro grupales
    const groupGoals = await prisma.savingsGoal.findMany({
      where: {
        groupId: { not: null },
        OR: [
          { userId }, // metas creadas por el usuario
          { 
            group: {
              groupMembers: {
                some: { userId } // o grupos donde es miembro
              }
            }
          }
        ]
      },
      orderBy: { createdAt: "desc" },
      include: {
        group: {
          select: { name: true, id: true }
        },
        savingsMovements: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    // 🆕 Obtener todas las categorías del usuario
    const categories = await prisma.category.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        type: true,
      },
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

    // calcular top categorías con desglose de gastos vs ingresos
    const expensesByCategory: Record<string, number> = {};
    const incomesByCategory: Record<string, number> = {};
    
    for (const t of recentTx) {
      const cat = t.category?.name ?? "Sin categoría";
      if (t.type === "expense") {
        expensesByCategory[cat] = (expensesByCategory[cat] || 0) + toNumber(t.amount);
      } else if (t.type === "income") {
        incomesByCategory[cat] = (incomesByCategory[cat] || 0) + toNumber(t.amount);
      }
    }
    
    const topExpenseCategories = Object.entries(expensesByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([category, amount]) => ({ category, amount, percentage: ((amount / totalExpenses) * 100).toFixed(1) }));

    const topIncomeCategories = Object.entries(incomesByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amount]) => ({ category, amount }));

    // 🆕 Análisis temporal: gastos e ingresos por mes (últimos 6 meses)
    const monthlyData: Record<string, { expenses: number; income: number; count: number }> = {};
    for (const t of recentTx) {
      const monthKey = t.occurredAt.toISOString().slice(0, 7); // "YYYY-MM"
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { expenses: 0, income: 0, count: 0 };
      }
      if (t.type === "expense") {
        monthlyData[monthKey].expenses += toNumber(t.amount);
      } else if (t.type === "income") {
        monthlyData[monthKey].income += toNumber(t.amount);
      }
      monthlyData[monthKey].count += 1;
    }

    const monthlyTrends = Object.entries(monthlyData)
      .sort((a, b) => b[0].localeCompare(a[0])) // más reciente primero
      .slice(0, 6)
      .reverse() // cronológico para gráficos
      .map(([month, data]) => ({
        month,
        expenses: data.expenses,
        income: data.income,
        balance: data.income - data.expenses,
        transactionCount: data.count,
      }));

    // 🆕 Análisis de metas de ahorro
    const savingsAnalysis = {
      personal: personalGoals.map(g => {
        const progress = (toNumber(g.currentAmount) / toNumber(g.targetAmount)) * 100;
        const remaining = toNumber(g.targetAmount) - toNumber(g.currentAmount);
        const daysUntilTarget = g.targetDate ? Math.ceil((g.targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
        
        return {
          id: g.id,
          title: g.title,
          targetAmount: toNumber(g.targetAmount),
          currentAmount: toNumber(g.currentAmount),
          remaining,
          progress: progress.toFixed(1),
          targetDate: g.targetDate,
          daysUntilTarget,
          status: progress >= 100 ? "completed" : daysUntilTarget && daysUntilTarget < 0 ? "overdue" : "active",
          recentMovements: g.savingsMovements.map(m => ({
            type: m.type,
            amount: toNumber(m.amount),
            note: m.note,
            date: m.createdAt,
          })),
          totalDeposits: g.savingsMovements.filter(m => m.type === "deposit").reduce((sum, m) => sum + toNumber(m.amount), 0),
          totalWithdrawals: g.savingsMovements.filter(m => m.type === "withdraw").reduce((sum, m) => sum + toNumber(m.amount), 0),
        };
      }),
      group: groupGoals.map(g => {
        const progress = (toNumber(g.currentAmount) / toNumber(g.targetAmount)) * 100;
        const remaining = toNumber(g.targetAmount) - toNumber(g.currentAmount);
        const daysUntilTarget = g.targetDate ? Math.ceil((g.targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
        
        return {
          id: g.id,
          title: g.title,
          groupName: g.group?.name,
          groupId: g.groupId,
          targetAmount: toNumber(g.targetAmount),
          currentAmount: toNumber(g.currentAmount),
          remaining,
          progress: progress.toFixed(1),
          targetDate: g.targetDate,
          daysUntilTarget,
          status: progress >= 100 ? "completed" : daysUntilTarget && daysUntilTarget < 0 ? "overdue" : "active",
          recentMovements: g.savingsMovements.map(m => ({
            type: m.type,
            amount: toNumber(m.amount),
            note: m.note,
            date: m.createdAt,
          })),
          totalDeposits: g.savingsMovements.filter(m => m.type === "deposit").reduce((sum, m) => sum + toNumber(m.amount), 0),
          totalWithdrawals: g.savingsMovements.filter(m => m.type === "withdraw").reduce((sum, m) => sum + toNumber(m.amount), 0),
        };
      }),
    };

    // 🆕 Calcular totales de ahorro
    const totalSavingsPersonal = personalGoals.reduce((sum, g) => sum + toNumber(g.currentAmount), 0);
    const totalSavingsGroup = groupGoals.reduce((sum, g) => sum + toNumber(g.currentAmount), 0);
    const totalSavingsGoals = personalGoals.length + groupGoals.length;

    // 🆕 Comparación presupuesto vs gasto real
    const budgetAnalysis = budgets.map(b => {
      const monthKey = b.month.toISOString().slice(0, 7); // "YYYY-MM"
      const categoryExpenses = recentTx
        .filter(t => 
          t.type === "expense" && 
          t.categoryId === b.categoryId && 
          t.occurredAt.toISOString().slice(0, 7) === monthKey
        )
        .reduce((sum, t) => sum + toNumber(t.amount), 0);
      
      const budgetAmount = toNumber(b.amount);
      const spent = categoryExpenses;
      const remaining = budgetAmount - spent;
      const percentageUsed = budgetAmount > 0 ? (spent / budgetAmount * 100).toFixed(1) : "0";

      return {
        month: monthKey,
        categoryId: b.categoryId,
        budgetAmount,
        spent,
        remaining,
        percentageUsed,
        status: spent > budgetAmount ? "exceeded" : spent > budgetAmount * 0.9 ? "warning" : "ok",
      };
    });

    // 🆕 Detectar patrones y anomalías
    const avgMonthlyExpense = monthlyTrends.length > 0 
      ? monthlyTrends.reduce((sum, m) => sum + m.expenses, 0) / monthlyTrends.length 
      : 0;
    const avgMonthlyIncome = monthlyTrends.length > 0 
      ? monthlyTrends.reduce((sum, m) => sum + m.income, 0) / monthlyTrends.length 
      : 0;

    const patterns = {
      avgMonthlyExpense: avgMonthlyExpense.toFixed(2),
      avgMonthlyIncome: avgMonthlyIncome.toFixed(2),
      avgMonthlySavings: (avgMonthlyIncome - avgMonthlyExpense).toFixed(2),
      savingsRate: avgMonthlyIncome > 0 ? (((avgMonthlyIncome - avgMonthlyExpense) / avgMonthlyIncome) * 100).toFixed(1) : "0",
      hasGoals: totalSavingsGoals > 0,
      activeGoalsCount: totalSavingsGoals,
      budgetExceeded: budgetAnalysis.filter(b => b.status === "exceeded").length,
    };

    const summary = {
      totals: { 
        totalIncome, 
        totalExpenses, 
        balance: totalIncome - totalExpenses,
        totalSavingsPersonal,
        totalSavingsGroup,
        totalSavings: totalSavingsPersonal + totalSavingsGroup,
      },
      topExpenseCategories,
      topIncomeCategories,
      monthlyTrends, // 📊 Para gráficos de línea/barras
      savingsGoals: savingsAnalysis, // 🎯 Análisis completo de metas
      budgetAnalysis, // 💰 Comparación presupuesto vs gasto
      patterns, // 🔍 Patrones y promedios
      recentTxCount: recentTx.length,
      recentTx: recentTx.slice(0, 15).map((t) => ({
        id: t.id,
        type: t.type,
        amount: toNumber(t.amount),
        category: t.category?.name ?? "Sin categoría",
        note: t.note,
        occurredAt: t.occurredAt,
      })),
      userQuestion: userQuestion || "",
    };

    // 2) Llamar a la IA para generar recomendación basada en el resumen
    async function generateAIFeedback(context: typeof summary) {
      const systemPrompt = `Eres 'CoFi asistente', un asistente experto en finanzas personales diseñado **exclusivamente para estudiantes** universitarios y de educación superior integrado en una app de gestión financiera. 

Tienes acceso a los datos reales del usuario en la app (transacciones, ingresos, gastos, categorías, presupuestos, **metas de ahorro individuales y grupales**, análisis temporal, y patrones de comportamiento financiero).

Tu objetivo: analizar el contexto financiero proporcionado y dar recomendaciones personalizadas, prácticas y motivacionales.

Reglas:
1. **Usa los datos del contexto**: menciona cifras específicas (ingresos totales, gastos por categoría, presupuesto, progreso en metas de ahorro, tendencias mensuales) del usuario.
2. **Sé específico y práctico**: no des consejos genéricos como "usa una app" - el usuario YA está en la app.
3. **Identifica patrones**: señala gastos hormiga, categorías con más gasto, tendencias mensuales (si está gastando más o menos), y oportunidades de ahorro.
4. **Analiza metas de ahorro**:
   - Si hay metas con poco progreso, sugiere ajustes en gastos para destinar más ahorro
   - Si hay metas grupales, reconoce la colaboración y sugiere estrategias colectivas
   - Si no hay metas, anima a crear alguna basada en sus ingresos y tasa de ahorro actual
   - Calcula cuánto necesita ahorrar mensualmente para alcanzar metas con fecha límite
5. **Analiza presupuestos**: si hay presupuestos excedidos o en alerta, sugiere ajustes específicos
6. **Usa tendencias**: compara meses anteriores, detecta si está mejorando o empeorando su situación financiera
7. **Motiva y educa**: explica el impacto de cambios pequeños en el ahorro a largo plazo.
8. **Responde en formato JSON** con estas propiedades:
   - recSummary (string): resumen corto de 1-2 líneas con la recomendación principal
   - recFull (string): explicación detallada con datos específicos del usuario, análisis de tendencias, estado de metas, y pasos de acción concretos
   - score (number): nivel de urgencia/importancia de 0 a 1 (usa 0.8-1.0 si hay presupuestos excedidos o metas en riesgo)`;

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
        // Fallback: plantilla mejorada con análisis completo de los datos del usuario
        const { totals, topExpenseCategories, savingsGoals, patterns } = context;
        
        let fallbackSummary = `Con ingresos de S/ ${totals.totalIncome.toFixed(2)} y gastos de S/ ${totals.totalExpenses.toFixed(2)}, tu balance es S/ ${totals.balance.toFixed(2)}.`;
        
        if (savingsGoals.personal.length > 0 || savingsGoals.group.length > 0) {
          fallbackSummary += ` Tienes ${patterns.activeGoalsCount} meta(s) de ahorro activa(s) con S/ ${totals.totalSavings.toFixed(2)} ahorrados.`;
        }

        let fallbackFull = `📊 **Análisis de tus finanzas:**\n\n`;
        fallbackFull += `**Resumen:**\n`;
        fallbackFull += `- Ingresos totales: S/ ${totals.totalIncome.toFixed(2)}\n`;
        fallbackFull += `- Gastos totales: S/ ${totals.totalExpenses.toFixed(2)}\n`;
        fallbackFull += `- Balance: S/ ${totals.balance.toFixed(2)}\n`;
        fallbackFull += `- Tasa de ahorro: ${patterns.savingsRate}%\n\n`;

        if (topExpenseCategories.length > 0) {
          fallbackFull += `**Principales categorías de gasto:**\n`;
          topExpenseCategories.slice(0, 3).forEach(c => {
            fallbackFull += `- ${c.category}: S/ ${c.amount.toFixed(2)} (${c.percentage}%)\n`;
          });
          fallbackFull += `\n`;
        }

        if (savingsGoals.personal.length > 0 || savingsGoals.group.length > 0) {
          fallbackFull += `**Estado de metas de ahorro:**\n`;
          savingsGoals.personal.forEach(g => {
            fallbackFull += `- ${g.title}: ${g.progress}% completado (S/ ${g.currentAmount.toFixed(2)} / S/ ${g.targetAmount.toFixed(2)})\n`;
          });
          savingsGoals.group.forEach(g => {
            fallbackFull += `- ${g.title} (${g.groupName}): ${g.progress}% completado (S/ ${g.currentAmount.toFixed(2)} / S/ ${g.targetAmount.toFixed(2)})\n`;
          });
          fallbackFull += `\n`;
        }

        fallbackFull += `💡 **Sugerencias:**\n`;
        fallbackFull += `1. Revisa tus principales categorías de gasto e identifica oportunidades de reducción\n`;
        if (patterns.savingsRate && parseFloat(patterns.savingsRate) < 20) {
          fallbackFull += `2. Tu tasa de ahorro es ${patterns.savingsRate}%. Intenta alcanzar al menos 20% para una mejor salud financiera\n`;
        }
        if (!patterns.hasGoals) {
          fallbackFull += `2. Considera crear metas de ahorro específicas para mantener motivación\n`;
        }

        return {
          recSummary: fallbackSummary,
          recFull: fallbackFull,
          score: 0.5,
        };
      }
    }

    const aiResult = await generateAIFeedback(summary);

    const recommendation = await prisma.aiRecommendation.create({
      data: {
        userId,
        conversationId: conversationId || null,
        recType,
        recSummary: aiResult.recSummary ?? userQuestion,
        recFull: aiResult.recFull ?? recFull,
        inputJson: { userQuestion: userQuestion || "", context: summary }, // Guardamos la pregunta del usuario y el contexto
        score: aiResult.score ?? score,
        model: MODEL_NAME,
      },
    });

    // Si es el primer mensaje de la conversación, generar título automáticamente
    if (conversationId) {
      const messageCount = await prisma.aiRecommendation.count({
        where: { conversationId },
      });

      if (messageCount === 1 && userQuestion) {
        const autoTitle = userQuestion.length > 50 ? userQuestion.substring(0, 50) + "..." : userQuestion;
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { title: autoTitle },
        });
      }
    }

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
