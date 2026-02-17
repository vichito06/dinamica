import { NextResponse } from "next/server";

export async function POST() {
    const res = NextResponse.json({ success: true });

    // Borra cookie de sesión (mismo nombre que usas en login)
    res.cookies.set({
        name: "admin_session",
        value: "",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });

    return res;
}
