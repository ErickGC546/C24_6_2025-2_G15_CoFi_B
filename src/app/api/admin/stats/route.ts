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

    // Fechas para filtros
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // 1. Total de usuarios
    const totalUsers = await prisma.user.count();

    // 2. Grupos activos
    const activeGroups = await prisma.group.count();

    // 3. Gastos del mes actual
    const expenseAgg = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        type: 'expense',
        isDeleted: false,
        occurredAt: { gte: startOfMonth, lte: endOfMonth },
      },
    });
    const totalExpensesMonth = expenseAgg._sum.amount ? Number(expenseAgg._sum.amount) : 0;

    // 4. Transacciones del mes
    const totalTransactionsMonth = await prisma.transaction.count({
      where: {
        isDeleted: false,
        occurredAt: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    // 5. Promedio de gasto por usuario
    const avgExpensePerUser = totalUsers > 0 ? totalExpensesMonth / totalUsers : 0;

    // 6. Últimas 10 transacciones
    const recentTransactions = await prisma.transaction.findMany({
      where: { isDeleted: false },
      take: 10,
      orderBy: { occurredAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        category: { select: { name: true } },
      },
    });

    const formattedTransactions = recentTransactions.map(t => ({
      date: t.occurredAt.toISOString(),
      userName: t.user?.name,
      userEmail: t.user?.email,
      description: t.note,
      category: t.category?.name,
      amount: Number(t.amount),
      currency: t.currency,
    }));

    // 7. Crecimiento de usuarios por mes (últimos 6 meses)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const usersByMonth = await prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
      SELECT 
        TO_CHAR(created_at, 'Mon') as month,
        COUNT(*)::bigint as count
      FROM "User"
      WHERE created_at >= ${sixMonthsAgo}
      GROUP BY TO_CHAR(created_at, 'Mon'), DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at)
    `;

    const userGrowth = usersByMonth.map(row => ({
      mes: row.month,
      usuarios: Number(row.count)
    }));

    // 8. Transacciones por día de la semana (últimos 7 días)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const transactionsByDay = await prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
      SELECT 
        TO_CHAR(occurred_at, 'Dy') as day,
        COUNT(*)::bigint as count
      FROM "Transaction"
      WHERE occurred_at >= ${sevenDaysAgo}
        AND is_deleted = false
      GROUP BY TO_CHAR(occurred_at, 'Dy'), DATE_TRUNC('day', occurred_at)
      ORDER BY DATE_TRUNC('day', occurred_at)
    `;

    const transactionsByDayFormatted = transactionsByDay.map(row => ({
      dia: row.day,
      count: Number(row.count)
    }));

    // 9. Gastos por categoría
    const expensesByCategory = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        type: 'expense',
        isDeleted: false,
        occurredAt: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { amount: true },
    });

    const categoriesData = await prisma.category.findMany({
      where: {
        id: { in: expensesByCategory.map(e => e.categoryId).filter(Boolean) as string[] },
      },
      select: { id: true, name: true },
    });

    const categoryMap = new Map(categoriesData.map(c => [c.id, c.name]));

    const expensesByCategoryFormatted = expensesByCategory
      .filter(e => e.categoryId)
      .map((e, index) => ({
        name: categoryMap.get(e.categoryId!) || 'Sin categoría',
        value: Number(e._sum.amount || 0),
        color: COLORS[index % COLORS.length]
      }));

    // 10. Ingresos vs Gastos por mes (últimos 6 meses)
    const monthlyData = await prisma.$queryRaw<Array<{ 
      month: string; 
      expenses: number; 
      income: number 
    }>>`
      SELECT 
        TO_CHAR(occurred_at, 'Mon') as month,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)::float as expenses,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END)::float as income
      FROM "Transaction"
      WHERE occurred_at >= ${sixMonthsAgo}
        AND is_deleted = false
      GROUP BY TO_CHAR(occurred_at, 'Mon'), DATE_TRUNC('month', occurred_at)
      ORDER BY DATE_TRUNC('month', occurred_at)
    `;

    const monthlyRevenue = monthlyData.map(row => ({
      mes: row.month,
      gastos: row.expenses,
      ingresos: row.income
    }));

    // 11. Actividad de usuarios por hora (últimas 24 horas)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const activityByHour = await prisma.$queryRaw<Array<{ hour: string; count: bigint }>>`
      SELECT 
        TO_CHAR(occurred_at, 'HH24:00') as hour,
        COUNT(DISTINCT user_id)::bigint as count
      FROM "Transaction"
      WHERE occurred_at >= ${twentyFourHoursAgo}
        AND is_deleted = false
        AND user_id IS NOT NULL
      GROUP BY TO_CHAR(occurred_at, 'HH24:00')
      ORDER BY TO_CHAR(occurred_at, 'HH24:00')
    `;

    const activeUsersData = activityByHour.map(row => ({
      hora: row.hour,
      usuarios: Number(row.count)
    }));

    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    return NextResponse.json({ 
      totalUsers, 
      totalExpensesMonth, 
      activeGroups,
      totalTransactionsMonth,
      avgExpensePerUser,
      recentTransactions: formattedTransactions,
      userGrowth,
      transactionsByDay: transactionsByDayFormatted,
      expensesByCategory: expensesByCategoryFormatted,
      monthlyRevenue,
      activeUsersData
    }, { status: 200 });
  } catch (error) {
    console.error('Error en /api/admin/stats:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
