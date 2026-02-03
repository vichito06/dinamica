import { NextResponse } from 'next/server';
import { pickWinner } from '@/lib/json-db';

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        const result = pickWinner();

        if (!result) {
            return NextResponse.json(
                { error: 'No se encontraron tickets pagados elegibles para el sorteo.' },
                { status: 400 }
            );
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error executing draw:', error);
        return NextResponse.json(
            { error: 'Error interno al realizar el sorteo.' },
            { status: 500 }
        );
    }
}
