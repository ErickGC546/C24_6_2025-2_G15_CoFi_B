import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

/* 🟣 LISTAR MIEMBROS DE UN GRUPO */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");

    if (!groupId)
      return NextResponse.json({ error: "Falta groupId" }, { status: 400 });

    const members = await prisma.groupMember.findMany({
      where: { groupId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { role: "asc" },
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error("Error en GET /groups/members:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* 🟠 ACTUALIZAR ROL DE UN MIEMBRO */
export async function PUT(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const requesterId = decoded.uid;

    const { memberId, newRole } = await req.json();
    if (!memberId || !newRole)
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    const member = await prisma.groupMember.findUnique({
      where: { id: memberId },
      include: { group: true },
    });

    if (!member)
      return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });

    // Solo el owner puede cambiar roles
    const requester = await prisma.groupMember.findFirst({
      where: { userId: requesterId, groupId: member.groupId },
    });
    if (!requester || requester.role !== "owner")
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const updated = await prisma.groupMember.update({
      where: { id: memberId },
      data: { role: newRole },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error en PUT /groups/members:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* 🔴 ELIMINAR MIEMBRO */
export async function DELETE(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const requesterId = decoded.uid;

    const { memberId } = await req.json();
    if (!memberId)
      return NextResponse.json({ error: "Falta memberId" }, { status: 400 });

    const member = await prisma.groupMember.findUnique({
      where: { id: memberId },
      include: { group: true },
    });

    if (!member)
      return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });

    // Solo el owner puede eliminar miembros
    const requester = await prisma.groupMember.findFirst({
      where: { userId: requesterId, groupId: member.groupId },
    });
    if (!requester || requester.role !== "owner")
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    await prisma.groupMember.delete({ where: { id: memberId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error en DELETE /groups/members:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
