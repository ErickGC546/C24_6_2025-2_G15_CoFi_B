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

    // ✅✅ ASEGURAR QUE EL AMOUNT TENGA EL SIGNO CORRECTO
    const finalAmount = type === 'income' ? Math.abs(amount) : -Math.abs(amount);

    const updated = await prisma.transaction.update({
      where: { id },
      data: { 
        amount: finalAmount,  // ← Guardar con el signo correcto
        note, 
        categoryId, 
        type 
      },
    });

    // ✅ CALCULAR NUEVO BALANCE
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: decoded.uid,
        isDeleted: false,
      },
      select: {
        amount: true,
      },
    });

    const newBalance = transactions.reduce((sum, t) => sum + t.amount.toNumber(), 0);

    // ✅✅ ACTUALIZAR EL BALANCE EN LA TABLA ACCOUNT
    await prisma.account.updateMany({
      where: {
        userId: decoded.uid,
      },
      data: {
        balance: newBalance,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: decoded.uid,
        action: `Editó una transacción`,
        detail: { id, amount: finalAmount, note },
      },
    });

    return NextResponse.json({
      id: updated.id,
      amount: updated.amount.toNumber(),
      note: updated.note,
      type: updated.type,
      categoryId: updated.categoryId,
      userId: updated.userId,
      occurredAt: updated.occurredAt,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      isDeleted: updated.isDeleted,
      goalId: updated.goalId,
      newBalance, // ← Nuevo balance
    });
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

    await prisma.transaction.delete({
      where: { id },
    });

    // ✅ CALCULAR NUEVO BALANCE (sin la transacción eliminada)
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: decoded.uid,
        isDeleted: false,
      },
      select: {
        amount: true,
        type: true,
      },
    });

    const newBalance = transactions.reduce((sum, t) => sum + t.amount.toNumber(), 0);

    // ✅ ACTUALIZAR BALANCE EN LA CUENTA
    if (existing.accountId) {
      await prisma.account.update({
        where: { id: existing.accountId },
        data: { balance: newBalance },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: decoded.uid,
        action: `Eliminó una transacción`,
        detail: { id },
      },
    });

    // ✅ DEVOLVER SUCCESS Y NUEVO BALANCE
    return NextResponse.json({
      success: true,
      newBalance, // ← Agregar el nuevo balance
    });
  } catch (error) {
    console.error("Error en DELETE /transactions/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}