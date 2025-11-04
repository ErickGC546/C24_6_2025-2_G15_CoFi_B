import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

// Devuelve totales por categoría (incluye categorías globales y del usuario), total sin categoría y porcentajes
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    // Sumar montos por categoría (solo gastos) usando left join para incluir categorías con 0
    const categorySums: Array<{ id: string | null; name: string | null; total: string }> = await prisma.$queryRaw`
      SELECT c.id, c.name, COALESCE(SUM(t.amount), 0)::text AS total
      FROM "Category" c
      LEFT JOIN "Transaction" t
        ON t."categoryId" = c.id
        AND t."userId" = ${userId}
        AND t."isDeleted" = false
        AND t."type" = 'expense'
      WHERE c."userId" = ${userId} OR c."userId" IS NULL
      GROUP BY c.id, c.name
      ORDER BY total::numeric DESC;
    `;

    // Total de transacciones sin categoría (uncategorized)
    const uncategorizedRes: Array<{ total: string }> = await prisma.$queryRaw`
      SELECT COALESCE(SUM(amount),0)::text AS total
      FROM "Transaction"
      WHERE "userId" = ${userId} AND "isDeleted" = false AND "categoryId" IS NULL AND "type" = 'expense'
    `;

    const uncategorizedTotal = Number(uncategorizedRes[0]?.total ?? 0);

    // Convertir a números y calcular total general
    const categoriesWithTotals = categorySums.map((c) => ({
      id: c.id,
      name: c.name ?? "Sin categoría",
      total: Number(c.total),
    }));

    const categoriesTotalSum = categoriesWithTotals.reduce((acc, cur) => acc + cur.total, 0);
    const overallTotal = categoriesTotalSum + uncategorizedTotal;

    // Añadir porcentaje por categoría
    const categoriesResult = categoriesWithTotals.map((c) => ({
      id: c.id,
      name: c.name,
      total: c.total,
      percentage: overallTotal > 0 ? Number(((c.total / overallTotal) * 100).toFixed(2)) : 0,
    }));

    const response = {
      categories: categoriesResult,
      uncategorizedTotal,
      overallTotal,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error en GET /reports/category:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
