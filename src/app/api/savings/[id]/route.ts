import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

/* 🟠 ACTUALIZAR meta */
export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const { title, targetAmount, currentAmount, targetDate } = await req.json();

    const existing = await prisma.savingsGoal.findUnique({
      where: { id: (await context.params).id },
    });

    // permisos: si pertenece a un grupo, cualquiera miembro puede actualizar; sino solo el owner de la meta
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    if (existing.groupId) {
      const member = await prisma.groupMember.findFirst({ where: { groupId: existing.groupId, userId: decoded.uid } });
      if (!member) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    } else {
      if (existing.userId !== decoded.uid)
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const updated = await prisma.savingsGoal.update({
      where: { id: (await context.params).id },
      data: { title, targetAmount, currentAmount, targetDate },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error en PUT /savings/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* 🔴 ELIMINAR meta */
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);

    const existing = await prisma.savingsGoal.findUnique({
      where: { id: (await context.params).id },
    });

    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    if (existing.groupId) {
      const member = await prisma.groupMember.findFirst({ where: { groupId: existing.groupId, userId: decoded.uid } });
      if (!member) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    } else {
      if (existing.userId !== decoded.uid) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await prisma.savingsGoal.delete({ where: { id: (await context.params).id } });
    await prisma.auditLog.create({
      data: {
        actorId: decoded.uid,
        action: existing.groupId ? "Eliminó una meta de ahorro de grupo" : "Eliminó una meta de ahorro",
        detail: { id: (await context.params).id, groupId: existing.groupId },
      },
    });


    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error en DELETE /savings/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* 🟣 DETALLE de una meta */
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);

    const goal = await prisma.savingsGoal.findUnique({
      where: { id: (await context.params).id },
    });

    if (!goal) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    if (goal.groupId) {
      const member = await prisma.groupMember.findFirst({ where: { groupId: goal.groupId, userId: decoded.uid } });
      if (!member) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    } else {
      if (goal.userId !== decoded.uid) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    return NextResponse.json(goal);
  } catch (error) {
    console.error("Error en GET /savings/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
