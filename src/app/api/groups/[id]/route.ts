import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";
import { safeSerialize } from "@/lib/serializers";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const group = await prisma.group.findUnique({
      where: { id: (await context.params).id },
      include: { groupMembers: { include: { user: true } } },
    });
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  return NextResponse.json(safeSerialize(group));
  } catch (error) {
    console.error("Error en GET /groups/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(
   req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const id = (await context.params).id;
    const { name, description, privacy } = await req.json();

    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });

    // Permisos: solo owner o admins de grupo pueden editar
    const isOwner = group.ownerId === userId;
    const member = await prisma.groupMember.findFirst({ where: { groupId: id, userId } });
    const isAdmin = !!member && member.role === "admin";
    if (!isOwner && !isAdmin)
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const updated = await prisma.group.update({
      where: { id },
      data: { name, description, privacy },
    });

    await prisma.auditLog.create({ data: { actorId: userId, action: "Actualizó grupo", detail: { groupId: id, name, description, privacy } } });

    return NextResponse.json(safeSerialize(updated));
  } catch (error) {
    console.error("Error en PUT /groups/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const id = (await context.params).id;

    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });

  // Solo el owner o un admin del grupo pueden eliminar el grupo
  const memberForDelete = await prisma.groupMember.findFirst({ where: { groupId: id, userId } });
  const isAdminForDelete = !!memberForDelete && memberForDelete.role === "admin";
  if (!(group.ownerId === userId || isAdminForDelete)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  await prisma.group.delete({ where: { id } });
    await prisma.auditLog.create({ data: { actorId: userId, action: "Eliminó grupo", detail: { groupId: id } } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error en DELETE /groups/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
