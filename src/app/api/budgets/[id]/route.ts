import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

/* 🟣 OBTENER presupuesto por ID */
export async function GET(
  req: Request, 
  { params }: { params: { id: string } }
) {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const decoded = await getAuth().verifyIdToken(token);

    const budget = await prisma.budget.findUnique({
      where: { id: params.id },
      include: { category: true },
    });

    if (!budget || budget.userId !== decoded.uid)
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    return NextResponse.json(budget);
  } catch (error) {
    console.error("Error en GET /budgets/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* 🟠 EDITAR presupuesto */
export async function PUT(
  req: Request, 
  { params }: { params: { id: string } }
) {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const decoded = await getAuth().verifyIdToken(token);
    const { amount, categoryId } = await req.json();

    const existing = await prisma.budget.findUnique({ where: { id: params.id } });
    if (!existing || existing.userId !== decoded.uid)
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const updated = await prisma.budget.update({
      where: { id: params.id },
      data: { amount, categoryId },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error en PUT /budgets/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/* 🔴 ELIMINAR presupuesto */
export async function DELETE(
  req: Request, 
  { params }: { params: { id: string } }
) {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const decoded = await getAuth().verifyIdToken(token);

    const existing = await prisma.budget.findUnique({ where: { id: params.id } });
    if (!existing || existing.userId !== decoded.uid)
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    await prisma.budget.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error en DELETE /budgets/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
