import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { backfillDeployment } from '@/lib/matching-engine';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body; // 'ACCEPTED' | 'DECLINED' | 'TIMED_OUT' | 'CHECKED_IN'

    if (!['ACCEPTED', 'DECLINED', 'TIMED_OUT', 'CHECKED_IN'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const deployment = await prisma.deployment.findUnique({
      where: { id: params.id },
      include: {
        volunteer: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        surgeEvent: true,
      },
    });

    if (!deployment) {
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    }

    // Validate ownership (volunteer can only respond to their own deployments)
    if (session.user.role !== 'ADMIN' && deployment.volunteer.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await prisma.deployment.update({
      where: { id: params.id },
      data: {
        status: action as any,
        respondedAt: new Date(),
      },
      include: {
        volunteer: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        surgeEvent: true,
      },
    });

    // Increment filledCount on surgeEvent when accepted
    if (action === 'ACCEPTED') {
      await prisma.surgeEvent.update({
        where: { id: deployment.surgeEventId },
        data: { filledCount: { increment: 1 } },
      });
    }

    // Emit deployment update to all clients
    const io = (global as any).io;
    if (io) {
      io.emit('deployment:updated', { deployment: updated });
      io.to('admin').emit('deployment:updated', { deployment: updated });
    }

    // On decline or timeout, check if the 20% buffer is exhausted before backfilling
    if (action === 'DECLINED' || action === 'TIMED_OUT') {
      console.log(`[Backfill] Volunteer ${action.toLowerCase()}, checking buffer for event ${deployment.surgeEventId}`);
      const newDeployments = await backfillDeployment(
        deployment.surgeEventId,
        deployment.volunteerId
      );
      if (newDeployments && newDeployments.length > 0) {
        console.log(`[Backfill] Notified ${newDeployments.length} replacement(s)`);
      } else if (newDeployments === null) {
        console.log('[Backfill] Buffer sufficient — no backfill needed');
      } else {
        console.log('[Backfill] No available replacements found');
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[Respond] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
