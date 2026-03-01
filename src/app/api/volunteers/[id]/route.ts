import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const volunteer = await prisma.volunteer.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        deployments: {
          include: { surgeEvent: true },
          orderBy: { notifiedAt: 'desc' },
        },
      },
    });

    if (!volunteer) {
      return NextResponse.json({ error: 'Volunteer not found' }, { status: 404 });
    }

    // Volunteers can only see their own profile
    if (session.user.role !== 'ADMIN' && volunteer.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(volunteer);
  } catch (error) {
    console.error('[Volunteer GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const volunteer = await prisma.volunteer.findUnique({
      where: { id: params.id },
    });

    if (!volunteer) {
      return NextResponse.json({ error: 'Volunteer not found' }, { status: 404 });
    }

    if (session.user.role !== 'ADMIN' && volunteer.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { isAvailable, skills, phone, latitude, longitude } = body;

    const updated = await prisma.volunteer.update({
      where: { id: params.id },
      data: {
        ...(isAvailable !== undefined ? { isAvailable } : {}),
        ...(skills ? { skills } : {}),
        ...(phone ? { phone } : {}),
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    // Emit availability update
    const io = (global as any).io;
    if (io) {
      io.emit('volunteer:updated', { volunteer: updated });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[Volunteer PATCH] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
