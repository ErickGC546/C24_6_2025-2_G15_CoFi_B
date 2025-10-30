import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

/* 🟣 LISTAR INVITACIONES DE UN GRUPO (owner/admin) */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");

    if (!groupId) return NextResponse.json({ error: "Falta groupId" }, { status: 400 });

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const requesterId = decoded.uid;

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });

    // Sólo owner o admin pueden listar invitaciones
    const isOwner = group.ownerId === requesterId;
    const member = await prisma.groupMember.findFirst({ where: { groupId, userId: requesterId } });
    const isAdmin = member && (member.role === "owner" || member.role === "admin");
    if (!isOwner && !isAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const invites = await prisma.groupInvite.findMany({
      where: { groupId, status: "pending" },
      include: {
        inviter: { select: { id: true, email: true, name: true } },
        inviteeUser: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(invites);
  } catch (error) {
    console.error("Error en GET /groups/invites:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const inviterId = decoded.uid;

    const { groupId, inviteeEmail } = await req.json();
    if (!groupId || !inviteeEmail)
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });

    // Permisos: solo owner o admin pueden invitar
    const isOwner = group.ownerId === inviterId;
    const memberRole = await prisma.groupMember.findFirst({
      where: { groupId, userId: inviterId },
      select: { role: true },
    });

    const isAdmin = memberRole && (memberRole.role === "owner" || memberRole.role === "admin");
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "No autorizado para invitar" }, { status: 403 });
    }

    const tokenInvite = Math.random().toString(36).substring(2, 12);

    const invite = await prisma.groupInvite.create({
      data: {
        groupId,
        inviterId,
        inviteeEmail,
        token: tokenInvite,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 días por defecto
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: inviterId,
        action: "Invitó a un miembro al grupo",
        detail: { inviteeEmail, groupId },
      },
    });

    return NextResponse.json({ message: "Invitación creada", invite });
  } catch (error) {
    console.error("Error en POST /groups/invites:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
