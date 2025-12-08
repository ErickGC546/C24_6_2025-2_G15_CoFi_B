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
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Obtener todos los usuarios con su fecha de creación
    const allUsers = await prisma.user.findMany({
      where: {
        createdAt: { gte: sixMonthsAgo }
      },
      select: {
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Agrupar por mes manualmente
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const usersByMonthMap = new Map<string, number>();
    
    // Inicializar últimos 6 meses con 0
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = `${monthNames[date.getMonth()]}`;
      usersByMonthMap.set(key, 0);
    }

    // Contar usuarios por mes
    allUsers.forEach(user => {
      const month = monthNames[user.createdAt.getMonth()];
      usersByMonthMap.set(month, (usersByMonthMap.get(month) || 0) + 1);
    });

    const userGrowth = Array.from(usersByMonthMap.entries()).map(([mes, usuarios]) => ({
      mes,
      usuarios
    }));

    // 8. Transacciones por día de la semana (últimos 7 días)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Obtener todas las transacciones de los últimos 7 días
    const recentTransactionsForChart = await prisma.transaction.findMany({
      where: {
        occurredAt: { gte: sevenDaysAgo },
        isDeleted: false
      },
      select: {
        occurredAt: true
      },
      orderBy: {
        occurredAt: 'asc'
      }
    });

    // Agrupar por día
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const transactionsByDayMap = new Map<string, number>();
    
    // Inicializar últimos 7 días
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayName = dayNames[date.getDay()];
      if (!transactionsByDayMap.has(dayName)) {
        transactionsByDayMap.set(dayName, 0);
      }
    }

    // Contar transacciones por día
    recentTransactionsForChart.forEach(transaction => {
      const dayName = dayNames[transaction.occurredAt.getDay()];
      transactionsByDayMap.set(dayName, (transactionsByDayMap.get(dayName) || 0) + 1);
    });

    const transactionsByDayFormatted = Array.from(transactionsByDayMap.entries()).map(([dia, count]) => ({
      dia,
      count
    }));

    // 9. Gastos por categoría (del mes actual)
    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    
    const expensesThisMonth = await prisma.transaction.findMany({
      where: {
        type: 'expense',
        isDeleted: false,
        occurredAt: { gte: startOfMonth, lte: endOfMonth },
        categoryId: { not: null }
      },
      select: {
        categoryId: true,
        amount: true,
        category: {
          select: {
            name: true
          }
        }
      }
    });

    // Agrupar por categoría
    const categoryTotals = new Map<string, { name: string; value: number }>();
    
    expensesThisMonth.forEach(expense => {
      if (expense.categoryId && expense.category) {
        const existing = categoryTotals.get(expense.categoryId);
        if (existing) {
          existing.value += Number(expense.amount);
        } else {
          categoryTotals.set(expense.categoryId, {
            name: expense.category.name,
            value: Number(expense.amount)
          });
        }
      }
    });

    const expensesByCategoryFormatted = Array.from(categoryTotals.values()).map((cat, index) => ({
      name: cat.name,
      value: cat.value,
      color: COLORS[index % COLORS.length]
    }));

    // 10. Ingresos vs Gastos por mes (últimos 6 meses)
    const allTransactions = await prisma.transaction.findMany({
      where: {
        occurredAt: { gte: sixMonthsAgo },
        isDeleted: false,
        type: { in: ['income', 'expense'] }
      },
      select: {
        occurredAt: true,
        type: true,
        amount: true
      },
      orderBy: {
        occurredAt: 'asc'
      }
    });

    // Agrupar por mes
    const monthlyRevenueMap = new Map<string, { gastos: number; ingresos: number }>();
    
    // Inicializar últimos 6 meses
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = monthNames[date.getMonth()];
      monthlyRevenueMap.set(key, { gastos: 0, ingresos: 0 });
    }

    // Sumar transacciones
    allTransactions.forEach(transaction => {
      const month = monthNames[transaction.occurredAt.getMonth()];
      const existing = monthlyRevenueMap.get(month);
      if (existing) {
        if (transaction.type === 'expense') {
          existing.gastos += Number(transaction.amount);
        } else if (transaction.type === 'income') {
          existing.ingresos += Number(transaction.amount);
        }
      }
    });

    const monthlyRevenue = Array.from(monthlyRevenueMap.entries()).map(([mes, data]) => ({
      mes,
      gastos: data.gastos,
      ingresos: data.ingresos
    }));

    // 11. Actividad de usuarios por hora (últimas 24 horas)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const recentActivity = await prisma.transaction.findMany({
      where: {
        occurredAt: { gte: twentyFourHoursAgo },
        isDeleted: false,
        userId: { not: null }
      },
      select: {
        occurredAt: true,
        userId: true
      },
      orderBy: {
        occurredAt: 'asc'
      }
    });

    // Agrupar por hora y contar usuarios únicos
    const hourlyActivity = new Map<string, Set<string>>();
    
    recentActivity.forEach(activity => {
      if (activity.userId) {
        const hour = `${activity.occurredAt.getHours().toString().padStart(2, '0')}:00`;
        if (!hourlyActivity.has(hour)) {
          hourlyActivity.set(hour, new Set());
        }
        hourlyActivity.get(hour)!.add(activity.userId);
      }
    });

    const activeUsersData = Array.from(hourlyActivity.entries())
      .map(([hora, users]) => ({
        hora,
        usuarios: users.size
      }))
      .sort((a, b) => a.hora.localeCompare(b.hora));

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
