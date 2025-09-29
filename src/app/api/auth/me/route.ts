import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];

    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch (error) {
      console.error("Token inválido:", error);
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    // Buscar usuario en DB
    let user = await prisma.user.findUnique({
      where: { id: decodedToken.uid },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: decodedToken.uid,
          email: decodedToken.email!,
          name: decodedToken.name ?? null,
          avatarUrl: decodedToken.picture ?? null,
        },
      });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error en /api/auth/me:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
