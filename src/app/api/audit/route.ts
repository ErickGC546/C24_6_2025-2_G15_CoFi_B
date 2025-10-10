import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

/* 🟢 Registrar un evento de auditoría */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const { action, detail } = await req.json();

    if (!action) {
      return NextResponse.json({ error: "Falta el campo 'action'" }, { status: 400 });
    }

    const log = await prisma.auditLog.create({
      data: {
        actorId: userId,
        action,
        detail,
      },
    });

    return NextResponse.json(log);
  } catch (error) {
    console.error("Error en POST /api/audit:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* 🟣 Listar registros de auditoría del usuario */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);

    const logs = await prisma.auditLog.findMany({
      where: { actorId: decoded.uid },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Error en GET /api/audit:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
