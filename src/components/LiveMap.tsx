'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getSocket } from '@/lib/socket';
import { EVENT_TYPE_COLORS, EVENT_TYPE_ICONS } from '@/types';

// Fix Leaflet default markers in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const createVolunteerIcon = (status: string) => {
  const colorMap: Record<string, string> = {
    NOTIFIED: '#f59e0b',
    ACCEPTED: '#22c55e',
    DECLINED: '#ef4444',
    CHECKED_IN: '#3b82f6',
    AVAILABLE: '#22c55e',
    UNAVAILABLE: '#6b7280',
  };
  const color = colorMap[status] ?? '#6b7280';

  return L.divIcon({
    className: '',
    html: `<div style="
      width: 12px; height: 12px;
      border-radius: 50%;
      background: ${color};
      border: 2px solid white;
      box-shadow: 0 0 6px ${color}80;
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
};

interface SurgeEvent {
  id: string;
  title: string;
  type: string;
  severity: number;
  status: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  skillsNeeded: string[];
  headcount: number;
  filledCount: number;
  autoTriggered: boolean;
  deployments?: Array<{
    id: string;
    status: string;
    distanceKm: number;
    volunteer: {
      latitude: number;
      longitude: number;
      user: { name: string };
    };
  }>;
}

interface LiveMapProps {
  height?: string;
  showVolunteers?: boolean;
  adminMode?: boolean;
}

export default function LiveMap({
  height = '500px',
  showVolunteers = true,
  adminMode = false,
}: LiveMapProps) {
  const [events, setEvents] = useState<SurgeEvent[]>([]);
  const [autoAlert, setAutoAlert] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/surge-events?status=ACTIVE');
      if (res.ok) setEvents(await res.json());
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchData();

    const socket = getSocket();

    socket.on('surge:created', fetchData);
    socket.on('surge:mobilized', fetchData);
    socket.on('surge:auto-triggered', (data: any) => {
      const icon =
        EVENT_TYPE_ICONS[data.sensorType?.toUpperCase() as keyof typeof EVENT_TYPE_ICONS] ?? '⚠️';
      setAutoAlert(`${icon} IoT Auto-Trigger: ${data.sensorType} exceeded threshold`);
      setTimeout(() => setAutoAlert(null), 8000);
      fetchData();
    });
    socket.on('deployment:updated', fetchData);

    return () => {
      socket.off('surge:created', fetchData);
      socket.off('surge:mobilized', fetchData);
      socket.off('surge:auto-triggered');
      socket.off('deployment:updated', fetchData);
    };
  }, []);

  // NYC center
  const center: [number, number] = [40.7128, -74.006];

  // Collect deployed volunteer positions from active events
  const deployedVolunteers: Array<{
    id: string;
    lat: number;
    lng: number;
    name: string;
    status: string;
    distanceKm: number;
    eventTitle: string;
  }> = [];

  if (showVolunteers) {
    events.forEach((evt) => {
      evt.deployments?.forEach((d) => {
        if (d.volunteer?.latitude) {
          deployedVolunteers.push({
            id: d.id,
            lat: d.volunteer.latitude,
            lng: d.volunteer.longitude,
            name: d.volunteer.user?.name ?? 'Volunteer',
            status: d.status,
            distanceKm: d.distanceKm,
            eventTitle: evt.title,
          });
        }
      });
    });
  }

  return (
    <div className="relative" style={{ height }}>
      {/* Auto-trigger alert banner */}
      {autoAlert && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-red-800 border border-red-500 text-white text-sm px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <span className="text-lg">🚨</span>
          {autoAlert}
        </div>
      )}

      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
        className="z-0"
      >
        {/* Dark map tiles */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19}
        />

        {/* Surge event circles */}
        {events.map((evt) => {
          const color =
            EVENT_TYPE_COLORS[evt.type as keyof typeof EVENT_TYPE_COLORS] ?? '#f59e0b';
          const icon =
            EVENT_TYPE_ICONS[evt.type as keyof typeof EVENT_TYPE_ICONS] ?? '⚠️';
          const pct =
            evt.headcount > 0 ? Math.round((evt.filledCount / evt.headcount) * 100) : 0;

          return (
            <Circle
              key={evt.id}
              center={[evt.latitude, evt.longitude]}
              radius={evt.radiusKm * 1000}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.18,
                weight: 2.5,
              }}
            >
              <Popup className="dark-popup">
                <div className="bg-slate-800 text-white p-3 rounded-lg min-w-[230px]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{icon}</span>
                    <div>
                      <div className="font-bold text-sm leading-tight">{evt.title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className="text-xs font-semibold px-1.5 py-0.5 rounded"
                          style={{ color, background: color + '25' }}
                        >
                          {evt.type}
                        </span>
                        {evt.autoTriggered && (
                          <span className="text-xs text-blue-400">IoT</span>
                        )}
                        <span className="text-xs text-slate-400">
                          Sev {evt.severity}/5
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 mb-1.5">
                    Radius: {evt.radiusKm} km ·{' '}
                    {evt.skillsNeeded.slice(0, 3).join(', ')}
                    {evt.skillsNeeded.length > 3 && ` +${evt.skillsNeeded.length - 3}`}
                  </div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Coverage</span>
                    <span
                      className={
                        pct >= 80
                          ? 'text-green-400'
                          : pct >= 50
                          ? 'text-amber-400'
                          : 'text-red-400'
                      }
                    >
                      {evt.filledCount}/{evt.headcount} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-600 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${
                        pct >= 80
                          ? 'bg-green-500'
                          : pct >= 50
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </Popup>
            </Circle>
          );
        })}

        {/* Volunteer markers */}
        {showVolunteers &&
          deployedVolunteers.map((v) => (
            <Marker
              key={v.id}
              position={[v.lat, v.lng]}
              icon={createVolunteerIcon(v.status)}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-bold">{v.name}</div>
                  <div
                    className={`text-xs mt-0.5 ${
                      v.status === 'ACCEPTED'
                        ? 'text-green-600'
                        : v.status === 'NOTIFIED'
                        ? 'text-amber-600'
                        : 'text-red-600'
                    }`}
                  >
                    {v.status}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {v.distanceKm.toFixed(1)} km from epicenter
                  </div>
                  <div className="text-xs text-gray-500">{v.eventTitle}</div>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[400] bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-xl p-3 text-xs space-y-1.5">
        <div className="font-semibold text-slate-300 mb-1">LEGEND</div>
        {[
          { color: '#22c55e', label: 'Accepted' },
          { color: '#f59e0b', label: 'Notified' },
          { color: '#ef4444', label: 'Declined' },
          { color: '#3b82f6', label: 'Checked In' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-slate-400">
            <div
              className="w-2.5 h-2.5 rounded-full border border-white/30"
              style={{ background: item.color }}
            />
            {item.label}
          </div>
        ))}
        {events.length > 0 && (
          <div className="border-t border-slate-700/50 mt-1.5 pt-1.5">
            <span className="text-red-400 animate-pulse font-medium">
              {events.length} ACTIVE EVENT{events.length > 1 ? 'S' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
