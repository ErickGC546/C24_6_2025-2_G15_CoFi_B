import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import "@/lib/firebaseAdmin";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const isDev = process.env.NODE_ENV !== 'production';

    let uid: string | undefined;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = await getAuth().verifyIdToken(token);
        uid = decoded.uid;
      } catch (e) {
        console.error('Token inválido en /api/admin/stats', e);
        if (!isDev) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
      }
    } else if (!isDev) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!isDev) {
      const caller = await prisma.user.findUnique({ where: { id: uid! }, select: { role: true } });
      if (!caller || caller.role !== 'admin') return NextResponse.json({ error: 'Prohibido' }, { status: 403 });
    }

    // total usuarios
    const totalUsers = await prisma.user.count();

    // gastos este mes (suma de transacciones tipo expense en el mes actual)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const expenseAgg = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        type: 'expense',
        isDeleted: false,
        occurredAt: { gte: startOfMonth, lte: endOfMonth },
      },
    });
    const totalExpensesMonth = expenseAgg._sum.amount ? Number(expenseAgg._sum.amount) : 0;

    // grupos creados (total)
    const activeGroups = await prisma.group.count();

    return NextResponse.json({ totalUsers, totalExpensesMonth, activeGroups }, { status: 200 });
  } catch (error) {
    console.error('Error en /api/admin/stats:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
