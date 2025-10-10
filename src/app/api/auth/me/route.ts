// src/app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];

    // ✅ Verificar el token de Firebase
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch (error) {
      console.error("❌ Token inválido:", error);
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    // ✅ Buscar el usuario en la base de datos
    const user = await prisma.user.findUnique({
      where: { id: decodedToken.uid },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        aiCreditsRemaining: true,
        aiMonthlyAllowance: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no registrado en la base de datos" },
        { status: 404 }
      );
    }

    // ✅ Evitar error con BigInt en JSON
    const safeUser = JSON.parse(
      JSON.stringify(user, (_, value) =>
        typeof value === "bigint" ? Number(value) : value
      )
    );

    return NextResponse.json(safeUser, { status: 200 });
  } catch (error) {
    console.error("💥 Error en /api/auth/me:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
