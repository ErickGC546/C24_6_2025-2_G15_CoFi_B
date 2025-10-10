import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

/* 🟣 LISTAR CUENTAS DEL USUARIO */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);

    const accounts = await prisma.account.findMany({
      where: { userId: decoded.uid },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Error en GET /accounts:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* 🟢 CREAR UNA NUEVA CUENTA */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const { name, balance, currency } = await req.json();

    const account = await prisma.account.create({
      data: {
        userId,
        name: name || "Nueva cuenta",
        balance: balance || 0,
        currency: currency || "PEN",
      },
    });

    return NextResponse.json(account);
  } catch (error) {
    console.error("Error en POST /accounts:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
