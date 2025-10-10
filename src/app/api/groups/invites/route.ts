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
    const inviterId = decoded.uid;

    const { groupId, inviteeEmail } = await req.json();
    if (!groupId || !inviteeEmail)
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });

    const tokenInvite = Math.random().toString(36).substring(2, 12);

    const invite = await prisma.groupInvite.create({
      data: {
        groupId,
        inviterId,
        inviteeEmail,
        token: tokenInvite,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3), // 3 días
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: inviterId,
        action: "Invitó a un miembro al grupo",
        detail: { inviteeEmail, groupId },
      },
    });

    return NextResponse.json({ message: "Invitación enviada", invite });
  } catch (error) {
    console.error("Error en POST /groups/invites:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
