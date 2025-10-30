import { NextResponse } from "next/server";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

/* 🟢 UNIRSE A UN GRUPO POR CÓDIGO */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
  const decoded = (await getAuth().verifyIdToken(token)) as DecodedIdToken;
  const userId = decoded.uid;

    const { joinCode } = await req.json();
    if (!joinCode) {
      return NextResponse.json({ error: "Falta el código de invitación" }, { status: 400 });
    }

    // Buscar grupo por código
    const group = await prisma.group.findUnique({
      where: { joinCode },
    });

    if (!group) {
      return NextResponse.json({ error: "Código inválido o grupo no encontrado" }, { status: 404 });
    }

    // Verificar si ya es miembro
    const alreadyMember = await prisma.groupMember.findFirst({
      where: { userId, groupId: group.id },
    });

    if (alreadyMember) {
      return NextResponse.json({ message: "Ya eres miembro de este grupo" });
    }

    // No permitir unirse a un grupo archivado
    if (group.isArchived) {
      return NextResponse.json({ error: "No se puede unir a un grupo archivado" }, { status: 400 });
    }

    // Agregar como miembro
    const member = await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId,
        role: "member",
      },
    });

    // Si existe una invitación pendiente para este email, marcarla como accepted
    try {
  const userEmail = decoded.email;
  if (userEmail) {
        await prisma.groupInvite.updateMany({
          where: { groupId: group.id, inviteeEmail: userEmail, status: "pending" },
          data: { status: "accepted", inviteeUserId: userId },
        });
      }
    } catch (e) {
      // No crítico: seguir adelante
      console.error("Warning: no se pudo actualizar invites al unirse por código:", e);
    }

    await prisma.auditLog.create({
      data: { actorId: userId, action: "Se unió al grupo por código", detail: { groupId: group.id } },
    });

    return NextResponse.json({
      message: "Te has unido al grupo correctamente",
      member,
      group,
    });
  } catch (error) {
    console.error("Error en POST /groups/join:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
