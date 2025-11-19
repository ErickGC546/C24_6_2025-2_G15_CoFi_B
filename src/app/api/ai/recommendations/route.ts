import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

/* 🟢 CREAR NUEVA RECOMENDACIÓN */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const { recType, recSummary, recFull, score } = await req.json();

    const recommendation = await prisma.aiRecommendation.create({
      data: {
        userId,
        recType,
        recSummary,
        recFull,
        score,
        model: "gemini-2.5-pro",
      },
    });

    return NextResponse.json(recommendation);
  } catch (error) {
    console.error("Error en POST /api/ai/recommendations:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* 🟣 OBTENER RECOMENDACIONES DEL USUARIO */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);

    const recommendations = await prisma.aiRecommendation.findMany({
      where: { userId: decoded.uid },
      orderBy: { generatedAt: "desc" },
      take: 10,
    });

    return NextResponse.json(recommendations);
  } catch (error) {
    console.error("Error en GET /api/ai/recommendations:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
