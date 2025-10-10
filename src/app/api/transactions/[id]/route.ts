import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

/* 🟠 EDITAR transacción */
export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const id = (await context.params).id;

    const { amount, note, categoryId, type } = await req.json();

    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing || existing.userId !== decoded.uid) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: { amount, note, categoryId, type },
    });
    await prisma.auditLog.create({
      data: {
        actorId: decoded.uid,
        action: `Editó una transacción`,
        detail: { id, amount, note },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error en PUT /transactions/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* 🔴 ELIMINAR transacción */
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const id = (await context.params).id;

    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing || existing.userId !== decoded.uid) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await prisma.transaction.update({
      where: { id },
      data: { isDeleted: true },
    });
    await prisma.auditLog.create({
      data: {
        actorId: decoded.uid,
        action: `Eliminó una transacción`,
        detail: { id },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error en DELETE /transactions/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
