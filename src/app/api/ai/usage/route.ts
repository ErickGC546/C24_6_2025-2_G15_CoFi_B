import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

/* 🟣 HISTORIAL DE CONSULTAS DE IA */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);

    const usageHistory = await prisma.aiUsage.findMany({
      where: { userId: decoded.uid },
      orderBy: { createdAt: "desc" },
      take: 10, // últimos 10 usos
    });

    return NextResponse.json(usageHistory);
  } catch (error) {
    console.error("Error en GET /api/ai/usage:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
