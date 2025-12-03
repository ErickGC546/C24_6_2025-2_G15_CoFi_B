import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

/* 🟢 OBTENER UNA CONVERSACIÓN CON TODOS SUS MENSAJES */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: params.id,
        userId,
      },
      include: {
        aiRecommendations: {
          orderBy: { generatedAt: "asc" },
          select: {
            id: true,
            recSummary: true,
            recFull: true,
            inputJson: true,
            model: true,
            score: true,
            generatedAt: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("Error en GET /api/ai/conversations/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* 🔴 ELIMINAR CONVERSACIÓN */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    // Verificar que la conversación pertenece al usuario
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: params.id,
        userId,
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
    }

    // Eliminar conversación (los mensajes se eliminan en cascada)
    await prisma.conversation.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: "Conversación eliminada" });
  } catch (error) {
    console.error("Error en DELETE /api/ai/conversations/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* 🟡 ACTUALIZAR TÍTULO DE CONVERSACIÓN */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "Título inválido" }, { status: 400 });
    }

    // Verificar que la conversación pertenece al usuario y actualizar
    const conversation = await prisma.conversation.updateMany({
      where: {
        id: params.id,
        userId,
      },
      data: { title },
    });

    if (conversation.count === 0) {
      return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Título actualizado" });
  } catch (error) {
    console.error("Error en PATCH /api/ai/conversations/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
