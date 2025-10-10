import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

/* 🟠 ACTUALIZAR meta */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const { title, targetAmount, currentAmount, targetDate } = await req.json();

    const existing = await prisma.savingsGoal.findUnique({
      where: { id: params.id },
    });

    if (!existing || existing.userId !== decoded.uid)
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const updated = await prisma.savingsGoal.update({
      where: { id: params.id },
      data: { title, targetAmount, currentAmount, targetDate },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error en PUT /savings/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* 🔴 ELIMINAR meta */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);

    const existing = await prisma.savingsGoal.findUnique({
      where: { id: params.id },
    });

    if (!existing || existing.userId !== decoded.uid)
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    await prisma.savingsGoal.delete({ where: { id: params.id } });
    await prisma.auditLog.create({
      data: {
        actorId: decoded.uid,
        action: "Eliminó una meta de ahorro",
        detail: { id: params.id },
      },
    });


    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error en DELETE /savings/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* 🟣 DETALLE de una meta */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);

    const goal = await prisma.savingsGoal.findUnique({
      where: { id: params.id },
    });

    if (!goal || goal.userId !== decoded.uid)
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    return NextResponse.json(goal);
  } catch (error) {
    console.error("Error en GET /savings/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
