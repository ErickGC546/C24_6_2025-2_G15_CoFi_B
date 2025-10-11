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

    // ✅ Verificar token de Firebase
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch (error) {
      console.error("❌ Token inválido:", error);
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const { uid, email, name, picture } = decodedToken;

    // ✅ Buscar usuario en DB
    let user = await prisma.user.findUnique({
      where: { id: uid },
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

    // 🆕 Si no existe, crearlo automáticamente
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: uid,
          email: email || "",
          name: name || "",
          avatarUrl: picture || "",
          role: "user",
          aiCreditsRemaining: 3, // créditos iniciales de IA
          aiMonthlyAllowance: 3,
        },
      });
    }

    // ✅ Evitar error con BigInt al serializar
    const safeUser = JSON.parse(
      JSON.stringify(user, (_, value) =>
        typeof value === "bigint" ? Number(value) : value
      )
    );

    return NextResponse.json(safeUser, { status: 200 });
  } catch (error) {
    console.error("💥 Error en /api/auth/me:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
