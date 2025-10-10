import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const result = await prisma.$queryRawUnsafe(`
      SELECT 
        c."name" AS category,
        t."type",
        SUM(t."amount")::numeric AS total
      FROM "Transaction" t
      LEFT JOIN "Category" c ON t."categoryId" = c."id"
      WHERE t."userId" = '${userId}' AND t."isDeleted" = false
      GROUP BY c."name", t."type"
      ORDER BY total DESC;
    `);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error en GET /reports/category:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
