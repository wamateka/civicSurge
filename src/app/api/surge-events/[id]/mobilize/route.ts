import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runMatchingEngine } from '@/lib/matching-engine';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[Mobilize] Running matching engine for surge event: ${params.id}`);

    const result = await runMatchingEngine(params.id);

    return NextResponse.json({
      message: 'Mobilization complete',
      needed: result.needed,
      notified: result.notified,
      overNotifiedBy: result.overNotifiedBy,
      searchRadiusKm: result.searchRadiusKm,
      avgDistanceKm: result.avgDistanceKm,
      nearestKm: result.nearestKm,
      farthestKm: result.farthestKm,
      expanded: result.expanded,
      skillCoverage: result.skillCoverage,
      resourceCoverage: result.resourceCoverage,
    });
  } catch (error) {
    console.error('[Mobilize] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
