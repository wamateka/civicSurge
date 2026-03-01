import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const events = await prisma.surgeEvent.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
      },
      include: {
        deployments: {
          include: {
            volunteer: {
              include: { user: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error('[SurgeEvents GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, type, severity, latitude, longitude, radiusKm, skillsNeeded, resourcesNeeded, headcount } = body;

    if (!title || !type || !severity || latitude === undefined || longitude === undefined || !radiusKm || !headcount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const surgeEvent = await prisma.surgeEvent.create({
      data: {
        title,
        type,
        severity: parseInt(severity),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radiusKm: parseFloat(radiusKm),
        skillsNeeded: Array.isArray(skillsNeeded) ? skillsNeeded : [],
        resourcesNeeded: Array.isArray(resourcesNeeded) ? resourcesNeeded : [],
        headcount: parseInt(headcount),
        filledCount: 0,
        status: 'ACTIVE',
        autoTriggered: false,
        createdBy: session.user.id,
      },
    });

    const io = (global as any).io;
    if (io) {
      io.emit('surge:created', { surgeEvent });
    }

    return NextResponse.json(surgeEvent, { status: 201 });
  } catch (error) {
    console.error('[SurgeEvents POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
