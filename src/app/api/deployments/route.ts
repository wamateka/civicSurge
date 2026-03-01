import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const surgeEventId = searchParams.get('surgeEventId');
    const volunteerId = searchParams.get('volunteerId');
    const status = searchParams.get('status');

    // Volunteers can only see their own deployments
    let whereVolunteerId = volunteerId;
    if (session.user.role === 'VOLUNTEER') {
      const volunteer = await prisma.volunteer.findUnique({
        where: { userId: session.user.id },
      });
      whereVolunteerId = volunteer?.id ?? 'none';
    }

    const deployments = await prisma.deployment.findMany({
      where: {
        ...(surgeEventId ? { surgeEventId } : {}),
        ...(whereVolunteerId ? { volunteerId: whereVolunteerId } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: {
        volunteer: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        surgeEvent: true,
      },
      orderBy: { notifiedAt: 'desc' },
    });

    return NextResponse.json(deployments);
  } catch (error) {
    console.error('[Deployments GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
