import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    // 🗓️ Obtener el rango del mes actual
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // 💸 Calcular ingresos y gastos
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        isDeleted: false,
        occurredAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    const totalIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpense = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // 💰 Saldo total de cuentas
    const accounts = await prisma.account.findMany({
      where: { userId },
    });
    const totalBalance = accounts.reduce(
      (sum, acc) => sum + Number(acc.balance),
      0
    );

    // 🎯 Presupuesto del mes
    const budget = await prisma.budget.findFirst({
      where: { userId, month: startOfMonth },
    });

    return NextResponse.json({
      userId,
      month: startOfMonth,
      totalIncome,
      totalExpense,
      totalBalance,
      budget: budget?.amount ?? 0,
      budgetUsed: totalExpense,
      remainingBudget: (budget?.amount ?? 0) - totalExpense,
    });
  } catch (error) {
    console.error("Error en /api/summary:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
