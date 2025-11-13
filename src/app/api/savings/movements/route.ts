import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

// temporal: alias para evitar errores TS hasta regenerar cliente prisma en CI/editor
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = prisma;

/**
 * GET /api/savings/movements?goalId=<id>
 * Devuelve el historial de movimientos (deposit/withdraw) de una meta de ahorro.
 */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);

    const { searchParams } = new URL(req.url);
    const goalId = searchParams.get("goalId") || searchParams.get("savingsGoalId");

    if (!goalId) {
      return NextResponse.json({ error: "Parámetro 'goalId' requerido" }, { status: 400 });
    }

    const goal = await prisma.savingsGoal.findUnique({ where: { id: goalId } });
    if (!goal) return NextResponse.json({ error: "Meta no encontrada" }, { status: 404 });

    // permisos: si la meta pertenece a un grupo, el usuario debe ser miembro; si es personal, debe ser el dueño
    if (goal.groupId) {
      const member = await prisma.groupMember.findFirst({ where: { groupId: goal.groupId, userId: decoded.uid } });
      if (!member) return NextResponse.json({ error: "No autorizado en este grupo" }, { status: 403 });
    } else {
      if (goal.userId !== decoded.uid) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const movements = await db.savingsMovement.findMany({
      where: { savingsGoalId: goalId },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(movements);
  } catch (error) {
    console.error("Error en GET /savings/movements:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/savings/movements
 * Cuerpo: { goalId, type: 'deposit'|'withdraw', amount, note?, transactionId? }
 * Crea un movimiento y actualiza `savingsGoal.currentAmount`.
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);

    const body = await req.json();
    const { goalId, type, amount, note, transactionId } = body;

    if (!goalId || !type || amount == null) {
      return NextResponse.json({ error: "Faltan campos: 'goalId', 'type', 'amount'" }, { status: 400 });
    }
    if (!["deposit", "withdraw"].includes(type)) {
      return NextResponse.json({ error: "Tipo inválido: debe ser 'deposit' o 'withdraw'" }, { status: 400 });
    }

    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) return NextResponse.json({ error: "'amount' debe ser un número mayor que 0" }, { status: 400 });

    const goal = await prisma.savingsGoal.findUnique({ where: { id: goalId } });
    if (!goal) return NextResponse.json({ error: "Meta no encontrada" }, { status: 404 });

    // permisos
    if (goal.groupId) {
      const member = await prisma.groupMember.findFirst({ where: { groupId: goal.groupId, userId: decoded.uid } });
      if (!member) return NextResponse.json({ error: "No autorizado en este grupo" }, { status: 403 });
    } else {
      if (goal.userId !== decoded.uid) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const current = Number(goal.currentAmount?.toString() ?? 0);
    const newCurrent = type === "deposit" ? current + amt : current - amt;
    if (newCurrent < 0) {
      return NextResponse.json({ error: "Saldo insuficiente en la meta" }, { status: 400 });
    }

    const txResults = await db.$transaction([
      db.savingsMovement.create({
        data: {
          savingsGoalId: goalId,
          userId: decoded.uid,
          groupId: goal.groupId ?? null,
          type,
          amount: amt.toString(),
          note: note ?? null,
          transactionId: transactionId ?? null,
        },
      }),
      db.savingsGoal.update({
        where: { id: goalId },
        data: { currentAmount: newCurrent.toString() },
      }),
      db.auditLog.create({
        data: {
          actorId: decoded.uid,
          action: goal.groupId ? `Movimiento en meta de grupo (${type})` : `Movimiento en meta (${type})`,
          detail: { goalId, amount: amt, type, note, transactionId },
        },
      }),
    ]);

    const movement = txResults[0];
    const updatedGoal = txResults[1];

    return NextResponse.json({ movement, updatedGoal });
  } catch (error) {
    console.error("Error en POST /savings/movements:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
