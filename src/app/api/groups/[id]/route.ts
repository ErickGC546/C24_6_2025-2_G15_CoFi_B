import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

export async function GET(
  req: Request, 
  { params }: { params: { id: string } }
) {
  try {
    const group = await prisma.group.findUnique({
      where: { id: params.id },
      include: { groupMembers: { include: { user: true } } },
    });
    if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
    return NextResponse.json(group);
  } catch (error) {
    console.error("Error en GET /groups/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(
  req: Request, 
  { params }: { params: { id: string } }
) {
  try {
    const { name, description, privacy } = await req.json();
    const updated = await prisma.group.update({
      where: { id: params.id },
      data: { name, description, privacy },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error en PUT /groups/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request, 
  { params }: { params: { id: string } }
) {
  try {
    await prisma.group.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error en DELETE /groups/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
