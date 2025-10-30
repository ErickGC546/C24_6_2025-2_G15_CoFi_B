import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";
import crypto from "crypto";

async function generateUniqueCode() {
  for (let i = 0; i < 5; i++) {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase(); // 8 hex chars
    const exists = await prisma.group.findUnique({ where: { joinCode: code } });
    if (!exists) return code;
  }
  // fallback
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}

export async function GET(
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

    const groupId = (await context.params).id;
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });

    // Sólo owner o admin puede ver el código
    const isOwner = group.ownerId === userId;
    const member = await prisma.groupMember.findFirst({ where: { groupId, userId } });
    const isAdmin = member && (member.role === "owner" || member.role === "admin");
    if (!isOwner && !isAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    return NextResponse.json({ joinCode: group.joinCode || null });
  } catch (error) {
    console.error("Error en GET /groups/[id]/joincode:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(
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

    const groupId = (await context.params).id;
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });

    // Solo owner o admin puede regenerar
    const isOwner = group.ownerId === userId;
    const member = await prisma.groupMember.findFirst({ where: { groupId, userId } });
    const isAdmin = member && (member.role === "owner" || member.role === "admin");
    if (!isOwner && !isAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const newCode = await generateUniqueCode();
    const updated = await prisma.group.update({ where: { id: groupId }, data: { joinCode: newCode } });

    await prisma.auditLog.create({ data: { actorId: userId, action: "Regeneró joinCode", detail: { groupId, newCode } } });

    return NextResponse.json({ message: "Código regenerado", joinCode: updated.joinCode });
  } catch (error) {
    console.error("Error en POST /groups/[id]/joincode:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
