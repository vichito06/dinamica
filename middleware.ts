import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ Endpoints que deben pasar SIEMPRE
  if (pathname === "/api/admin/login" || pathname === "/api/admin/logout") return NextResponse.next();

  // ✅ Login vive en /admin (NO bloquear)
  if (pathname === "/admin") return NextResponse.next();

  // ✅ Proteger todo lo demás dentro de /admin y /api/admin
  if (pathname.startsWith("/admin/") || pathname.startsWith("/api/admin")) {
    const cookie = req.cookies.get("admin_session")?.value;

    if (!cookie) {
      // API -> 401 JSON
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { success: false, error: "Unauthenticated" },
          { status: 401 }
        );
      }
      // Web -> redirige al login /admin
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
