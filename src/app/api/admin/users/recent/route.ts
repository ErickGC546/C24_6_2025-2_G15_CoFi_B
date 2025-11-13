import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import "@/lib/firebaseAdmin";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    // En entorno de desarrollo permitimos listar usuarios sin requerir role admin
    const isDev = process.env.NODE_ENV !== 'production';

    let uid: string | undefined;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decodedToken = await getAuth().verifyIdToken(token);
        uid = decodedToken.uid;
      } catch (error) {
        console.error("Token inválido:", error);
        if (!isDev) return NextResponse.json({ error: "Token inválido" }, { status: 401 });
      }
    } else if (!isDev) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Si no estamos en dev, comprobar que el usuario que llama sea admin según la BD
    if (!isDev) {
      const caller = await prisma.user.findUnique({ where: { id: uid! }, select: { role: true } });
      if (!caller || caller.role !== "admin") {
        return NextResponse.json({ error: "Prohibido" }, { status: 403 });
      }
    }

    // Obtener los usuarios más recientes
    // Obtener los usuarios más recientes junto con sus cuentas para calcular el balance total
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        accounts: {
          select: {
            balance: true,
            currency: true,
          },
        },
        // incluir budgets del mes actual (usaremos un rango en la mapping)
        budgets: {
          select: {
            amount: true,
            month: true,
          },
        },
      },
    });

    // Calcular balance total por usuario (sumando balances de sus cuentas).
    // Además, calcular la suma neta de transacciones (ingresos - gastos) como fallback.
    const mapped = await Promise.all(
      users.map(async (u) => {
        const total = u.accounts && u.accounts.length
          ? u.accounts.reduce((acc, a) => acc + Number(a.balance ?? 0), 0)
          : 0;

        // Calcular suma de ingresos y gastos por separado para obtener neto (ingresos - gastos)
        const incomeAgg = await prisma.transaction.aggregate({
          _sum: { amount: true },
          where: { userId: u.id, isDeleted: false, type: 'income' },
        });
        const expenseAgg = await prisma.transaction.aggregate({
          _sum: { amount: true },
          where: { userId: u.id, isDeleted: false, type: 'expense' },
        });

        const incomeSum = incomeAgg._sum.amount ? Number(incomeAgg._sum.amount) : 0;
        const expenseSum = expenseAgg._sum.amount ? Number(expenseAgg._sum.amount) : 0;
        const transactionsNet = incomeSum - expenseSum;

        // Obtener presupuesto del mes actual desde la relación incluida
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
        let budgetAmount = 0;
        if (u.budgets && u.budgets.length) {
          const found = u.budgets.find((b: any) => {
            const m = new Date(b.month).getTime();
            return m >= startOfMonth && m < startOfNextMonth;
          });
          if (found) budgetAmount = Number(found.amount ?? 0);
          else {
            // Si no hay presupuesto para el mes actual, mostrar el presupuesto más reciente disponible
            const latest = u.budgets.reduce((prev: any, cur: any) => {
              return new Date(cur.month).getTime() > new Date(prev.month).getTime() ? cur : prev;
            }, u.budgets[0]);
            if (latest) budgetAmount = Number(latest.amount ?? 0);
          }
        }

        return {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          avatarUrl: u.avatarUrl,
          createdAt: u.createdAt,
          totalBalance: total,
          transactionsNet,
          budgetAmount,
          currency: u.accounts && u.accounts[0]?.currency ? u.accounts[0].currency : 'PEN',
        };
      })
    );

    // Serializar fechas/BigInt si hace falta. Decimal ya fue convertido a Number.
    const safe = JSON.parse(JSON.stringify(mapped, (_, value) => (typeof value === "bigint" ? Number(value) : value)));

    return NextResponse.json(safe, { status: 200 });
  } catch (error) {
    console.error("Error en /api/admin/users/recent:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
