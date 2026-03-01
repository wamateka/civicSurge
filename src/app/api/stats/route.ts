import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [
      totalVolunteers,
      availableVolunteers,
      activeEvents,
      totalDeployments,
      acceptedDeployments,
      filledSum,
      headcountSum,
    ] = await Promise.all([
      prisma.volunteer.count(),
      prisma.volunteer.count({ where: { isAvailable: true } }),
      prisma.surgeEvent.count({ where: { status: 'ACTIVE' } }),
      prisma.deployment.count({
        where: {
          surgeEvent: { status: 'ACTIVE' },
          status: { not: 'DECLINED' },
        },
      }),
      prisma.deployment.count({
        where: {
          status: 'ACCEPTED',
          surgeEvent: { status: 'ACTIVE' },
        },
      }),
      prisma.surgeEvent.aggregate({
        where: { status: 'ACTIVE' },
        _sum: { filledCount: true },
      }),
      prisma.surgeEvent.aggregate({
        where: { status: 'ACTIVE' },
        _sum: { headcount: true },
      }),
    ]);

    const totalFilled = filledSum._sum.filledCount ?? 0;
    const totalHeadcount = headcountSum._sum.headcount ?? 0;
    const coveragePct = totalHeadcount > 0 ? Math.round((totalFilled / totalHeadcount) * 100) : 0;

    return NextResponse.json({
      totalVolunteers,
      availableVolunteers,
      activeEvents,
      totalDeployments,
      acceptedDeployments,
      coveragePct,
    });
  } catch (error) {
    console.error('[Stats GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
