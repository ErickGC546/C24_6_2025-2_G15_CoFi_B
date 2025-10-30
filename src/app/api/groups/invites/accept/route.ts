import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const { token: inviteToken } = await req.json();
    if (!inviteToken)
      return NextResponse.json({ error: "Falta token de invitación" }, { status: 400 });

    const invite = await prisma.groupInvite.findUnique({ where: { token: inviteToken } });
    if (!invite) return NextResponse.json({ error: "Invitación inválida" }, { status: 404 });

    if (invite.status !== "pending")
      return NextResponse.json({ error: "Invitación no válida" }, { status: 400 });

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      // marcar como expired
      await prisma.groupInvite.update({ where: { id: invite.id }, data: { status: "expired" } });
      return NextResponse.json({ error: "La invitación expiró" }, { status: 410 });
    }

    // Si la invitación fue enviada a un email, verificar que coincida con el email del user
    if (invite.inviteeEmail) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (!user || !user.email || user.email.toLowerCase() !== invite.inviteeEmail.toLowerCase()) {
        return NextResponse.json({ error: "El email del usuario no coincide con la invitación" }, { status: 403 });
      }
    }

    // Evitar duplicados
    const already = await prisma.groupMember.findFirst({ where: { groupId: invite.groupId, userId } });
    if (!already) {
      await prisma.groupMember.create({ data: { groupId: invite.groupId, userId, role: "member" } });
    }

    await prisma.groupInvite.update({ where: { id: invite.id }, data: { status: "accepted", inviteeUserId: userId } });

    await prisma.auditLog.create({ data: { actorId: userId, action: "Aceptó invitación de grupo", detail: { groupId: invite.groupId } } });

    return NextResponse.json({ message: "Invitación aceptada" });
  } catch (error) {
    console.error("Error en POST /groups/invites/accept:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
