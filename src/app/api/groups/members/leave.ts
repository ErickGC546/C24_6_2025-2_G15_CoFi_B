import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import "@/lib/firebaseAdmin";

/* 🟡 SALIR DE UN GRUPO */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const token = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const { groupId } = await req.json();
    if (!groupId)
      return NextResponse.json({ error: "Falta groupId" }, { status: 400 });

    const member = await prisma.groupMember.findFirst({
      where: { userId, groupId },
    });

    if (!member)
      return NextResponse.json({ error: "No eres miembro de este grupo" }, { status: 404 });

    if (member.role === "owner")
      return NextResponse.json(
        { error: "El propietario no puede abandonar el grupo" },
        { status: 400 }
      );

    await prisma.groupMember.delete({
      where: { id: member.id },
    });

    return NextResponse.json({ message: "Has salido del grupo correctamente" });
  } catch (error) {
    console.error("Error en POST /groups/members/leave:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
