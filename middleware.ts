```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const path = pathname.replace(/\/$/, ""); // Normalizar: sin barra al final

  // ✅ Rutas Públicas de Admin (Login y Status)
  const isPublicRoute = 
    path === "/admin/login" || 
    path === "/api/admin/login" || 
    path === "/api/admin/me";

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // ✅ Protege el área Admin
  if (path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/admin")) {
    const session = req.cookies.get("admin_session")?.value;
    const secret = (process.env.ADMIN_SESSION_SECRET ?? "").trim();

    const isAuthenticated = session && secret && session === secret;

    if (!isAuthenticated) {
      // API -> 401
      if (path.startsWith("/api/")) {
        return NextResponse.json(
          { success: false, error: "Unauthenticated" },
          { status: 401 }
        );
      }

      // UI -> Redirigir a login
      const loginUrl = new URL("/admin/login", req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin(.*)", "/api/admin(.*)"],
};
```
