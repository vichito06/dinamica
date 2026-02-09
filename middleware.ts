
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    // Check if the path starts with /admin
    if (path.startsWith('/admin')) {
        const adminAuth = request.cookies.get('admin_auth');
        const isAuthenticated = adminAuth?.value === 'true';

        // 1. If trying to access login page (/admin) while authenticated -> redirect to dashboard
        if (path === '/admin' && isAuthenticated) {
            return NextResponse.redirect(new URL('/admin/dashboard', request.url));
        }

        // 2. If trying to access protected routes (/admin/dashboard, etc) while NOT authenticated -> redirect to login
        if (path.startsWith('/admin/dashboard') && !isAuthenticated) {
            return NextResponse.redirect(new URL('/admin', request.url));
        }
    }

    return NextResponse.next();
}

// Configure which paths the middleware runs on
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - logo.png (public assets)
         */
        '/((?!api|_next/static|_next/image|favicon.ico|logo.png|payphone-logo.png).*)',
    ],
};
