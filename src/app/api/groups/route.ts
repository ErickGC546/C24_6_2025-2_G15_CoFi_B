import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";
import { safeSerialize } from "@/lib/serializers";
import crypto from "crypto";

async function generateUniqueJoinCode() {
  for (let i = 0; i < 6; i++) {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase(); // 8 chars
    const existing = await prisma.group.findUnique({ where: { joinCode: code } });
    if (!existing) return code;
  }
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}

/* 🟢 Crear grupo */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const { name, description, privacy } = await req.json();

    if (!name)
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });

  const joinCode = await generateUniqueJoinCode();

    const group = await prisma.group.create({
      data: {
        ownerId: userId,
        name,
        description,
        privacy: privacy || "invite_only",
        joinCode,
        groupMembers: {
          create: { userId, role: "owner" },
        },
      },
      include: { groupMembers: true },
    });
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "Creó un grupo colaborativo",
        detail: { groupName: name },
      },
    });


  return NextResponse.json(safeSerialize(group));
  } catch (error) {
    console.error("Error en POST /groups:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* 🟣 Listar grupos del usuario */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);

    const groups = await prisma.group.findMany({
      where: {
        OR: [
          { ownerId: decoded.uid },
          { groupMembers: { some: { userId: decoded.uid } } },
        ],
      },
      include: { groupMembers: true },
    });

  return NextResponse.json(safeSerialize(groups));
  } catch (error) {
    console.error("Error en GET /groups:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
