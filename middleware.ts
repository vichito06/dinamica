
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;
    const adminAuth = request.cookies.get('admin_auth');
    const isAuthenticated = adminAuth?.value === 'true';

    // Handle API Admin routes
    if (path.startsWith('/api/admin')) {
        if (!isAuthenticated) {
            return new NextResponse(
                JSON.stringify({ success: false, error: 'Unauthenticated' }),
                { status: 401, headers: { 'content-type': 'application/json' } }
            );
        }
        return NextResponse.next();
    }

    // Handle Admin UI routes
    if (path.startsWith('/admin')) {
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
    matcher: ["/admin/:path*", "/api/admin/:path*"],
};
