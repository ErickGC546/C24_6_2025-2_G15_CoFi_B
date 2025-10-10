import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

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

    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

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


    return NextResponse.json(group);
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

    return NextResponse.json(groups);
  } catch (error) {
    console.error("Error en GET /groups:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
