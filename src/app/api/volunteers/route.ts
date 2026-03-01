import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const available = searchParams.get('available');
    const countOnly = searchParams.get('countOnly') === 'true';
    const lat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null;
    const lng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null;
    const radiusKm = searchParams.get('radiusKm') ? parseFloat(searchParams.get('radiusKm')!) : null;

    const volunteers = await prisma.volunteer.findMany({
      where: {
        ...(available === 'true' ? { isAvailable: true } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        deployments: {
          where: { status: { in: ['NOTIFIED', 'ACCEPTED'] } },
          include: { surgeEvent: true },
          orderBy: { notifiedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter by radius if lat/lng/radiusKm provided
    const filtered =
      lat !== null && lng !== null && radiusKm !== null
        ? volunteers.filter((v) => haversine(lat, lng, v.latitude, v.longitude) <= radiusKm)
        : volunteers;

    if (countOnly) {
      return NextResponse.json({ count: filtered.length });
    }

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('[Volunteers GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
