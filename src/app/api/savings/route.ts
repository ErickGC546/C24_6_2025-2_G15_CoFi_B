import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

/* 🟢 CREAR una nueva meta de ahorro */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const { title, targetAmount, targetDate } = await req.json();

    if (!title || !targetAmount) {
      return NextResponse.json(
        { error: "Faltan datos: 'title' y 'targetAmount' son obligatorios" },
        { status: 400 }
      );
    }

    const goal = await prisma.savingsGoal.create({
      data: {
        userId,
        title,
        targetAmount,
        targetDate: targetDate ? new Date(targetDate) : null,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "Actualizó meta de ahorro",
        detail: { title, targetAmount, targetDate},
      },
    });


    return NextResponse.json(goal);
  } catch (error) {
    console.error("Error en POST /savings:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* 🟣 LISTAR todas las metas de ahorro del usuario */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);

    const goals = await prisma.savingsGoal.findMany({
      where: { userId: decoded.uid },
      orderBy: { createdAt: "desc" },
    });
    

    return NextResponse.json(goals);
  } catch (error) {
    console.error("Error en GET /savings:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
