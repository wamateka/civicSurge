import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const volunteer = await prisma.volunteer.findUnique({
      where: { userId: session.user.id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        deployments: {
          include: {
            surgeEvent: true,
            volunteer: {
              include: { user: true },
            },
          },
          orderBy: { notifiedAt: 'desc' },
        },
      },
    });

    if (!volunteer) {
      return NextResponse.json({ error: 'Volunteer profile not found' }, { status: 404 });
    }

    return NextResponse.json(volunteer);
  } catch (error) {
    console.error('[Volunteer Me] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
