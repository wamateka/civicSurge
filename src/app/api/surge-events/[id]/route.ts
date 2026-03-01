import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const event = await prisma.surgeEvent.findUnique({
      where: { id: params.id },
      include: {
        deployments: {
          include: {
            volunteer: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
          orderBy: { notifiedAt: 'desc' },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error('[SurgeEvent GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { status, title, severity, headcount, skillsNeeded, resourcesNeeded } = body;

    const updated = await prisma.surgeEvent.update({
      where: { id: params.id },
      data: {
        ...(status !== undefined && { status, ...(status === 'CLOSED' ? { closedAt: new Date() } : {}) }),
        ...(title !== undefined && { title }),
        ...(severity !== undefined && { severity }),
        ...(headcount !== undefined && { headcount }),
        ...(skillsNeeded !== undefined && { skillsNeeded }),
        ...(resourcesNeeded !== undefined && { resourcesNeeded }),
      },
    });

    const io = (global as any).io;
    if (io) {
      io.emit('surge:updated', { surgeEvent: updated });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[SurgeEvent PATCH] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
