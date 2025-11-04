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

    // Agrupar transacciones por semana y tipo
    const result = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('week', "occurredAt") AS week,
        "type",
        SUM("amount")::numeric AS total
      FROM "Transaction"
      WHERE "userId" = ${userId} AND "isDeleted" = false
      GROUP BY week, "type"
      ORDER BY week ASC;
    `;

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error en GET /reports/weekly:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
