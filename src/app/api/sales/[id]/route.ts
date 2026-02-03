import { NextResponse } from 'next/server';
import { getSaleById, updateSale } from '@/lib/json-db';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const id = parseInt(params.id, 10);
    const sale = getSaleById(id);

    if (!sale) {
        return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    return NextResponse.json(sale);
}

export async function PUT(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id, 10);
        const body = await request.json();

        const updatedSale = updateSale(id, body);
        return NextResponse.json(updatedSale);
    } catch (error) {
        console.error('Update Sale Error:', error);
        return NextResponse.json({ error: 'Failed to update sale' }, { status: 500 });
    }
}
