import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

/* 🟢 LISTAR CONVERSACIONES DEL USUARIO */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const conversations = await prisma.conversation.findMany({
      where: { userId },
      include: {
        aiRecommendations: {
          orderBy: { generatedAt: "asc" },
          take: 1, // Solo el primer mensaje para preview
          select: {
            id: true,
            recSummary: true,
            inputJson: true,
            generatedAt: true,
          },
        },
        _count: {
          select: { aiRecommendations: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(conversations);
  } catch (error) {
    console.error("Error en GET /api/ai/conversations:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* 🟣 CREAR NUEVA CONVERSACIÓN */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const body = await req.json();
    const { title } = body;

    const conversation = await prisma.conversation.create({
      data: {
        userId,
        title: title || "Nueva conversación",
      },
    });

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("Error en POST /api/ai/conversations:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
