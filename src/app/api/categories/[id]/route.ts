import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

/* ✏️ EDITAR categoría */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const { name, type } = await req.json();

    const existing = await prisma.category.findUnique({
      where: { id: params.id },
    });

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const updated = await prisma.category.update({
      where: { id: params.id },
      data: { name, type },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error en PUT /categories/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* 🗑 ELIMINAR categoría */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const existing = await prisma.category.findUnique({
      where: { id: params.id },
    });

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await prisma.category.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error en DELETE /categories/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
