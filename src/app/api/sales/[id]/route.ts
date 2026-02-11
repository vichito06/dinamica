
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idParam } = await params;
        const id = idParam; // id is string (UUID in Prisma, but here it might be serial or UUID depending on schema)
        // Wait, my schema uses @id @default(uuid()).

        const sale = await prisma.sale.findUnique({
            where: { id: idParam },
            include: {
                tickets: true,
                customer: true
            }
        });

        if (!sale) {
            return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
        }

        return NextResponse.json(sale);
    } catch (error) {
        console.error('Fetch Sale Error:', error);
        return NextResponse.json({ error: 'Failed to fetch sale' }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idParam } = await params;
        const body = await request.json();

        const updatedSale = await prisma.sale.update({
            where: { id: idParam },
            data: body
        });
        return NextResponse.json(updatedSale);
    } catch (error) {
        console.error('Update Sale Error:', error);
        return NextResponse.json({ error: 'Failed to update sale' }, { status: 500 });
    }
}
