import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

/* 🟢 CREAR o ACTUALIZAR presupuesto */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const { month, amount, categoryId } = await req.json();

    if (!month || !amount) {
      return NextResponse.json(
        { error: "Faltan datos: 'month' y 'amount' son obligatorios" },
        { status: 400 }
      );
    }

    const monthStart = new Date(new Date(month).getFullYear(), new Date(month).getMonth(), 1);

    const budget = await prisma.budget.upsert({
      where: {
        userId_month_categoryId: {
          userId,
          month: monthStart,
          categoryId: categoryId ?? null,
        },
      },
      update: { amount },
      create: { userId, month: monthStart, amount, categoryId: categoryId ?? null },
    });
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "Actualizó presupuesto mensual",
        detail: { month, amount },
      },
    });


    return NextResponse.json(budget);
  } catch (error) {
    console.error("Error en POST /budgets:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* 🟣 LISTAR presupuestos del usuario */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);

    const budgets = await prisma.budget.findMany({
      where: { userId: decoded.uid },
      include: { category: true },
      orderBy: { month: "desc" },
    });


    return NextResponse.json(budgets);
  } catch (error) {
    console.error("Error en GET /budgets:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
