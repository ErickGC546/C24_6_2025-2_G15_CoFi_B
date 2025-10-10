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

    // Agrupar transacciones por mes y tipo
    const result = await prisma.$queryRawUnsafe(`
      SELECT 
        DATE_TRUNC('month', "occurredAt") AS month,
        "type",
        SUM("amount")::numeric AS total
      FROM "Transaction"
      WHERE "userId" = '${userId}' AND "isDeleted" = false
      GROUP BY month, "type"
      ORDER BY month ASC;
    `);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error en GET /reports/monthly:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
