// src/proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const token = req.cookies.get("session")?.value;

  // 🔒 Protege rutas privadas
  if (!token && req.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

// Aplica solo a rutas que quieres proteger
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/perfil/:path*", // puedes agregar más rutas privadas aquí
  ],
};
