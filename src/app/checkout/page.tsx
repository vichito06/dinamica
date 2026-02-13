import { Suspense } from "react";
import CheckoutClient from "./CheckoutClient";

// (Opcional pero recomendado) evita que Next intente prerender estático el checkout
export const dynamic = "force-dynamic";

export default function Page() {
    return (
        <Suspense fallback={<div style={{ padding: 24, minHeight: '100vh', backgroundColor: '#000', color: '#fff' }}>Cargando checkout...</div>}>
            <CheckoutClient />
        </Suspense>
    );
}
