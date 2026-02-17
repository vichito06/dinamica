import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // ✅ Deja pasar el login SIEMPRE
    if (pathname === "/admin/login" || pathname === "/api/admin/login") {
        return NextResponse.next();
    }

    // ✅ Protege /admin y /api/admin
    if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
        const cookie = req.cookies.get("admin_session")?.value;

        if (!cookie) {
            // API: responde 401 JSON
            if (pathname.startsWith("/api/")) {
                return NextResponse.json(
                    { success: false, error: "Unauthenticated" },
                    { status: 401 }
                );
            }

            // Web: redirige al login
            const url = req.nextUrl.clone();
            url.pathname = "/admin/login";
            return NextResponse.redirect(url);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/admin/:path*", "/api/admin/:path*"],
};
