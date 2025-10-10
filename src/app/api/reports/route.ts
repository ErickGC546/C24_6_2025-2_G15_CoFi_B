import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    // Obtener cuentas del usuario
    const accounts = await prisma.account.findMany({
      where: { userId },
      select: { balance: true },
    });

    const totalBalance = accounts.reduce(
      (acc, curr) => acc + Number(curr.balance),
      0
    );

    // Calcular gastos e ingresos
    const transactions = await prisma.transaction.findMany({
      where: { userId, isDeleted: false },
      select: { type: true, amount: true },
    });

    const totalIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((acc, curr) => acc + Number(curr.amount), 0);

    const totalExpense = transactions
      .filter((t) => t.type === "expense")
      .reduce((acc, curr) => acc + Number(curr.amount), 0);

    const savings = totalIncome - totalExpense;

    return NextResponse.json({
      totalBalance,
      totalIncome,
      totalExpense,
      savings,
    });
  } catch (error) {
    console.error("Error en GET /reports:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
