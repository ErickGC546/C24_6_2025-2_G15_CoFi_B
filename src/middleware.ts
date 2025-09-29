import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuth } from "firebase-admin/auth";
import "@/lib/firebaseAdmin";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("__session")?.value;

  // Si no hay token, redirige al login
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await getAuth().verifyIdToken(token);
    return NextResponse.next(); // sigue la ruta
  } catch (error) {
    console.error("Token inválido en middleware:", error);
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

// Aplica middleware a rutas privadas
export const config = {
  matcher: ["/dashboard/:path*", "/api/private/:path*"],
};
