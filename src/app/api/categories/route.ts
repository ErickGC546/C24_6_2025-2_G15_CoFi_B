import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

/* 🟣 LISTAR categorías del usuario */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);

    // Categorías del usuario o globales (userId NULL)
    const categories = await prisma.category.findMany({
      where: {
        OR: [{ userId: decoded.uid }, { userId: null }],
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error en GET /categories:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* 🟢 CREAR categoría personalizada */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const { name, type } = await req.json();

    if (!name || !type) {
      return NextResponse.json(
        { error: "Faltan datos: name y type son obligatorios" },
        { status: 400 }
      );
    }

    const existing = await prisma.category.findFirst({
      where: { userId, name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Ya existe una categoría con ese nombre" },
        { status: 409 }
      );
    }

    const category = await prisma.category.create({
      data: { userId, name, type },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error en POST /categories:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
