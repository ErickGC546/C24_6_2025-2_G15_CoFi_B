import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import "@/lib/firebaseAdmin";

/* 🟢 CREAR transacción */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const { type, amount, categoryId, note } = await req.json();

    if (!type || !amount) {
      return NextResponse.json(
        { error: "Faltan campos: 'type' y 'amount' son obligatorios" },
        { status: 400 }
      );
    }

    // Buscar o crear cuenta principal
    let account = await prisma.account.findFirst({ where: { userId } });
    if (!account) {
      account = await prisma.account.create({
        data: { userId, name: "Cuenta principal", balance: 0, currency: "PEN" },
      });
    }

    // Ajustar saldo según el tipo
    let newBalance = new Decimal(account.balance);
    if (type === "expense") newBalance = newBalance.minus(new Decimal(amount));
    else if (type === "income") newBalance = newBalance.plus(new Decimal(amount));

    // Crear la transacción
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        accountId: account.id,
        type,
        amount,
        categoryId,
        note,
        occurredAt: new Date(),
      },
    });

    // Actualizar saldo
    await prisma.account.update({
      where: { id: account.id },
      data: { balance: newBalance },
    });
    // Después de crear transacción
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: `Creó una transacción (${type})`,
        detail: { amount, categoryId, note },
      },
    });

    // Devolver respuesta con datos actualizados
    return NextResponse.json({
      message: "✅ Transacción registrada exitosamente",
      transaction,
      newBalance: newBalance.toNumber(),
    });
  } catch (error) {
    console.error("Error en POST /transactions:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}


/* 🟣 LISTAR transacciones */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);

    const transactions = await prisma.transaction.findMany({
      where: { userId: decoded.uid, isDeleted: false },
      orderBy: { occurredAt: "desc" },
      include: {
        category: { select: { name: true, type: true } },
        account: { select: { name: true, currency: true } },
      },
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Error en GET /transactions:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
