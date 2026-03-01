import { prisma } from './prisma';
import { sendSMS, buildMobilizationSMS } from './twilio';
import type { MatchingResult } from '@/types';

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface ScoredVolunteer {
  id: string;
  phone: string;
  latitude: number;
  longitude: number;
  skills: string[];
  resources: string[];
  user: { id: string; name: string; email: string };
  distance: number;
  score: number;
}

function scoreAndFilter(
  volunteers: any[],
  eventLat: number,
  eventLng: number,
  eventRadiusKm: number,
  searchRadiusKm: number,
  skillsNeeded: string[],
  resourcesNeeded: string[]
): ScoredVolunteer[] {
  return volunteers
    .map((v) => {
      const distance = haversineDistance(eventLat, eventLng, v.latitude, v.longitude);

      // Proximity: 0km → 1.0, at event radius → 0.5, beyond → decreasing, minimum 0.1
      const proximityScore = Math.max(0.1, 1.0 - distance / (eventRadiusKm * 2));

      // Skill match fraction (0.5 baseline if none required)
      const skillScore =
        skillsNeeded.length === 0
          ? 0.5
          : v.skills.filter((s: string) => skillsNeeded.includes(s)).length / skillsNeeded.length;

      // Resource match fraction (0.5 baseline if none required)
      const resourceScore =
        resourcesNeeded.length === 0
          ? 0.5
          : v.resources.filter((r: string) => resourcesNeeded.includes(r)).length / resourcesNeeded.length;

      // Weighted score: proximity is primary factor
      const score = 0.55 * proximityScore + 0.25 * skillScore + 0.20 * resourceScore;

      return { ...v, distance, score };
    })
    .filter((v) => v.distance <= searchRadiusKm)
    .sort((a, b) => {
      const diff = b.score - a.score;
      if (Math.abs(diff) > 0.001) return diff;
      return a.distance - b.distance; // tiebreak by proximity
    });
}

function computeCoverage(
  selected: ScoredVolunteer[],
  needed: string[],
  field: 'skills' | 'resources'
): Record<string, number> {
  if (needed.length === 0) return {};
  const coverage: Record<string, number> = {};
  for (const item of needed) {
    coverage[item] = selected.filter((v) => v[field].includes(item)).length;
  }
  return coverage;
}

export async function runMatchingEngine(surgeEventId: string): Promise<MatchingResult> {
  const surgeEvent = await prisma.surgeEvent.findUnique({ where: { id: surgeEventId } });
  if (!surgeEvent) throw new Error('Surge event not found: ' + surgeEventId);

  // Exclude volunteers already deployed to this event (except declined — they opted out)
  const existing = await prisma.deployment.findMany({
    where: { surgeEventId, status: { not: 'DECLINED' } },
    select: { volunteerId: true },
  });
  const excludeIds = existing.map((d) => d.volunteerId);

  // Fetch all available volunteers not already contacted
  const allVolunteers = await prisma.volunteer.findMany({
    where: {
      isAvailable: true,
      ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (allVolunteers.length === 0) {
    return {
      needed: surgeEvent.headcount,
      notified: 0,
      overNotifiedBy: 0,
      searchRadiusKm: surgeEvent.radiusKm,
      avgDistanceKm: null,
      nearestKm: null,
      farthestKm: null,
      expanded: false,
      skillCoverage: {},
      resourceCoverage: {},
    };
  }

  // Over-notify by 20% to buffer against declines
  const notifyCount = Math.ceil(surgeEvent.headcount * 1.2);
  let searchRadiusKm = surgeEvent.radiusKm;
  let expanded = false;

  let candidates = scoreAndFilter(
    allVolunteers,
    surgeEvent.latitude,
    surgeEvent.longitude,
    surgeEvent.radiusKm,
    searchRadiusKm,
    surgeEvent.skillsNeeded,
    surgeEvent.resourcesNeeded
  );

  // Expand radius until we have enough candidates or reach 100km cap
  while (candidates.length < notifyCount && searchRadiusKm < 100) {
    searchRadiusKm = Math.min(searchRadiusKm * 1.5, 100);
    expanded = true;
    candidates = scoreAndFilter(
      allVolunteers,
      surgeEvent.latitude,
      surgeEvent.longitude,
      surgeEvent.radiusKm,
      searchRadiusKm,
      surgeEvent.skillsNeeded,
      surgeEvent.resourcesNeeded
    );
  }

  // Always notify someone — even if fewer than notifyCount exist
  const selected = candidates.slice(0, notifyCount);

  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const deployments = [];

  for (const vol of selected) {
    const dep = await prisma.deployment.create({
      data: {
        volunteerId: vol.id,
        surgeEventId,
        distanceKm: parseFloat(vol.distance.toFixed(2)),
        status: 'NOTIFIED',
      },
      include: {
        volunteer: { include: { user: true } },
        surgeEvent: true,
      },
    });
    deployments.push(dep);
    await sendSMS(vol.phone, buildMobilizationSMS(vol.user.name, surgeEvent.title, surgeEvent.type, appUrl, dep.id));
  }

  const skillCoverage = computeCoverage(selected, surgeEvent.skillsNeeded, 'skills');
  const resourceCoverage = computeCoverage(selected, surgeEvent.resourcesNeeded, 'resources');

  const result: MatchingResult = {
    needed: surgeEvent.headcount,
    notified: selected.length,
    overNotifiedBy: Math.max(0, selected.length - surgeEvent.headcount),
    searchRadiusKm: parseFloat(searchRadiusKm.toFixed(1)),
    avgDistanceKm: selected.length
      ? parseFloat((selected.reduce((s, v) => s + v.distance, 0) / selected.length).toFixed(2))
      : null,
    nearestKm:  selected[0]     ? parseFloat(selected[0].distance.toFixed(2))     : null,
    farthestKm: selected.at(-1) ? parseFloat(selected.at(-1)!.distance.toFixed(2)) : null,
    expanded,
    skillCoverage,
    resourceCoverage,
  };

  const io = (global as any).io;
  if (io) io.emit('surge:mobilized', { surgeEventId, deployments, result });

  return result;
}

export async function backfillDeployment(
  surgeEventId: string,
  _declinedVolunteerId: string
): Promise<any[] | null> {
  const surgeEvent = await prisma.surgeEvent.findUnique({ where: { id: surgeEventId } });
  if (!surgeEvent) return null;

  // Check if the 20% buffer still covers us: ACCEPTED + remaining NOTIFIED >= headcount
  const activeCount = await prisma.deployment.count({
    where: {
      surgeEventId,
      status: { in: ['ACCEPTED', 'NOTIFIED'] },
    },
  });

  if (activeCount >= surgeEvent.headcount) {
    // Buffer is absorbing the decline — no backfill needed
    return null;
  }

  // Buffer exhausted — notify enough to cover the gap
  const gap = surgeEvent.headcount - activeCount;

  const existing = await prisma.deployment.findMany({
    where: { surgeEventId },
    select: { volunteerId: true },
  });
  const excludeIds = existing.map((d) => d.volunteerId);

  const allVolunteers = await prisma.volunteer.findMany({
    where: {
      isAvailable: true,
      ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (allVolunteers.length === 0) return null;

  let searchRadiusKm = surgeEvent.radiusKm;
  let candidates = scoreAndFilter(
    allVolunteers,
    surgeEvent.latitude,
    surgeEvent.longitude,
    surgeEvent.radiusKm,
    searchRadiusKm,
    surgeEvent.skillsNeeded,
    surgeEvent.resourcesNeeded
  );

  while (candidates.length === 0 && searchRadiusKm < 100) {
    searchRadiusKm = Math.min(searchRadiusKm * 1.5, 100);
    candidates = scoreAndFilter(
      allVolunteers,
      surgeEvent.latitude,
      surgeEvent.longitude,
      surgeEvent.radiusKm,
      searchRadiusKm,
      surgeEvent.skillsNeeded,
      surgeEvent.resourcesNeeded
    );
  }

  if (candidates.length === 0) return null;

  const backfillCount = Math.min(Math.ceil(gap * 1.2), candidates.length);
  const selected = candidates.slice(0, backfillCount);
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const newDeployments = [];

  for (const vol of selected) {
    const dep = await prisma.deployment.create({
      data: {
        volunteerId: vol.id,
        surgeEventId,
        distanceKm: parseFloat(vol.distance.toFixed(2)),
        status: 'NOTIFIED',
      },
      include: { volunteer: { include: { user: true } }, surgeEvent: true },
    });
    newDeployments.push(dep);
    await sendSMS(vol.phone, buildMobilizationSMS(vol.user.name, surgeEvent.title, surgeEvent.type, appUrl, dep.id));

    const io = (global as any).io;
    if (io) io.emit('deployment:updated', { deployment: dep });
  }

  return newDeployments;
}
