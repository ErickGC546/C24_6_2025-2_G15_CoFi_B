import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import "@/lib/firebaseAdmin";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    // En entorno de desarrollo permitimos listar usuarios sin requerir role admin
    const isDev = process.env.NODE_ENV !== 'production';

    let uid: string | undefined;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decodedToken = await getAuth().verifyIdToken(token);
        uid = decodedToken.uid;
      } catch (error) {
        console.error("Token inválido:", error);
        if (!isDev) return NextResponse.json({ error: "Token inválido" }, { status: 401 });
      }
    } else if (!isDev) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Si no estamos en dev, comprobar que el usuario que llama sea admin según la BD
    if (!isDev) {
      const caller = await prisma.user.findUnique({ where: { id: uid! }, select: { role: true } });
      if (!caller || caller.role !== "admin") {
        return NextResponse.json({ error: "Prohibido" }, { status: 403 });
      }
    }

    // Obtener los usuarios más recientes
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    // Serializar fechas/BigInt si hace falta
    const safe = JSON.parse(JSON.stringify(users, (_, value) => (typeof value === "bigint" ? Number(value) : value)));

    return NextResponse.json(safe, { status: 200 });
  } catch (error) {
    console.error("Error en /api/admin/users/recent:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
