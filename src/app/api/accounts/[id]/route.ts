import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

/* 🟠 EDITAR CUENTA */
export async function PUT(
  req: Request, 
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);

    const { name, balance } = await req.json();
    const id = params.id;

    const existing = await prisma.account.findUnique({ where: { id } });
    if (!existing || existing.userId !== decoded.uid) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const updated = await prisma.account.update({
      where: { id },
      data: { name, balance },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error en PUT /accounts/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* 🔴 ELIMINAR CUENTA */
export async function DELETE(
  req: Request, 
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);

    const id = params.id;
    const existing = await prisma.account.findUnique({ where: { id } });

    if (!existing || existing.userId !== decoded.uid) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Evitar eliminar si tiene transacciones asociadas
    const hasTransactions = await prisma.transaction.count({
      where: { accountId: id },
    });

    if (hasTransactions > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar la cuenta porque tiene transacciones." },
        { status: 400 }
      );
    }

    await prisma.account.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error en DELETE /accounts/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
