import { Suspense } from "react";
import CancelContent from "./CancelContent";

export default function CancelPage() {
    return (
        <Suspense fallback={<div className="p-6 text-white text-center">Cargando...</div>}>
            <CancelContent />
        </Suspense>
    );
}
