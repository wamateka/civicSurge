import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runMatchingEngine } from '@/lib/matching-engine';
import { EVENT_TYPE_SKILLS, EVENT_TYPE_RESOURCES } from '@/types';

interface ThresholdConfig {
  eventType: string;
  threshold: number;
}

const SENSOR_THRESHOLDS: Record<string, ThresholdConfig> = {
  water_level: { eventType: 'FLOOD', threshold: 80 },
  wind_speed: { eventType: 'TORNADO', threshold: 95 },
  temperature: { eventType: 'WILDFIRE', threshold: 110 },
  snow_depth: { eventType: 'SNOW', threshold: 24 },
};

function getTitleForType(eventType: string, sensorName?: string): string {
  const location = sensorName ? ` — ${sensorName}` : '';
  const labels: Record<string, string> = {
    FLOOD: 'Flood Alert',
    TORNADO: 'Tornado Warning',
    WILDFIRE: 'Wildfire Alert',
    SNOW: 'Severe Snow Event',
  };
  return `[AUTO] ${labels[eventType] ?? eventType}${location}`;
}

function getRadiusKm(value: number, threshold: number): number {
  const overage = (value - threshold) / threshold;
  if (overage < 0.1) return 5;
  if (overage < 0.3) return 10;
  return 15;
}

// Haversine distance in km
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sensorId, latitude, longitude, type, value, threshold } = body;

    if (!sensorId || latitude === undefined || longitude === undefined || !type || value === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const thresholdConfig = SENSOR_THRESHOLDS[type as keyof typeof SENSOR_THRESHOLDS];
    const effectiveThreshold = threshold ?? thresholdConfig?.threshold ?? 100;

    // Save the reading
    const reading = await prisma.sensorReading.create({
      data: {
        sensorId,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        type,
        value: parseFloat(value),
        threshold: parseFloat(effectiveThreshold),
      },
    });

    // Emit sensor reading to all clients
    const io = (global as any).io;
    if (io) {
      io.emit('sensor:reading', { reading });
    }

    // Check threshold and auto-trigger if exceeded
    const exceeded = parseFloat(value) >= parseFloat(effectiveThreshold);

    if (exceeded && thresholdConfig) {
      // Cooldown check: find any non-CLOSED SurgeEvent of same type where sensor lat/lng falls within its radius
      const activeEvents = await prisma.surgeEvent.findMany({
        where: {
          type: thresholdConfig.eventType as any,
          status: { not: 'CLOSED' as any },
          autoTriggered: true,
        },
        select: { id: true, latitude: true, longitude: true, radiusKm: true },
      });

      const sensorLat = parseFloat(latitude);
      const sensorLng = parseFloat(longitude);

      const existingCoverage = activeEvents.find((evt) => {
        const dist = haversineKm(sensorLat, sensorLng, evt.latitude, evt.longitude);
        return dist <= evt.radiusKm;
      });

      if (!existingCoverage) {
        const radiusKm = getRadiusKm(parseFloat(value), parseFloat(effectiveThreshold));

        console.log(
          `[IoT] Threshold exceeded: ${type} = ${value} >= ${effectiveThreshold} at (${sensorLat}, ${sensorLng})`
        );
        console.log(`[IoT] Auto-triggering ${thresholdConfig.eventType} event, radius=${radiusKm}km...`);

        const surgeEvent = await prisma.surgeEvent.create({
          data: {
            title: getTitleForType(thresholdConfig.eventType, `sensor_${sensorId}`),
            type: thresholdConfig.eventType as any,
            severity: 3,
            latitude: sensorLat,
            longitude: sensorLng,
            radiusKm,
            skillsNeeded: EVENT_TYPE_SKILLS[thresholdConfig.eventType as keyof typeof EVENT_TYPE_SKILLS] ?? ['General Labor'],
            resourcesNeeded: EVENT_TYPE_RESOURCES[thresholdConfig.eventType as keyof typeof EVENT_TYPE_RESOURCES] ?? [],
            headcount: 10,
            filledCount: 0,
            status: 'ACTIVE',
            autoTriggered: true,
            createdBy: `sensor_${sensorId}`,
          },
        });

        // Update reading with triggered surge ID
        await prisma.sensorReading.update({
          where: { id: reading.id },
          data: { triggeredSurgeId: surgeEvent.id },
        });

        // Emit events
        if (io) {
          io.emit('surge:created', { surgeEvent });
          io.emit('sensor:threshold-exceeded', {
            sensorId,
            latitude: sensorLat,
            longitude: sensorLng,
            type,
            value,
            threshold: effectiveThreshold,
            surgeEventId: surgeEvent.id,
          });
          io.emit('surge:auto-triggered', {
            sensorId,
            latitude: sensorLat,
            longitude: sensorLng,
            sensorType: type,
            value,
            threshold: effectiveThreshold,
            surgeEvent,
          });
        }

        // Run matching engine
        console.log(`[IoT] Running matching engine for auto-triggered event: ${surgeEvent.id}`);
        const matchingResult = await runMatchingEngine(surgeEvent.id);
        console.log(`[IoT] Notified ${matchingResult.notified} of ${matchingResult.needed} needed volunteers`);

        return NextResponse.json({
          reading,
          autoTriggered: true,
          surgeEventId: surgeEvent.id,
          matchingResult,
        });
      }
    }

    return NextResponse.json({ reading, autoTriggered: false });
  } catch (error) {
    console.error('[SensorReading] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    const readings = await prisma.sensorReading.findMany({
      where: type ? { type } : {},
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    return NextResponse.json(readings);
  } catch (error) {
    console.error('[SensorReading GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
