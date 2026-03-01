'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { getSocket } from '@/lib/socket';
import { EVENT_TYPE_ICONS } from '@/types';

const LiveMap = dynamic(() => import('@/components/LiveMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400 text-sm animate-pulse">Loading map...</div>
    </div>
  ),
});

interface ActiveEvent {
  id: string;
  title: string;
  type: string;
  severity: number;
  latitude: number;
  longitude: number;
  radiusKm: number;
  headcount: number;
  filledCount: number;
  autoTriggered: boolean;
  createdAt: string;
}

export default function PublicMapPage() {
  const [events, setEvents] = useState<ActiveEvent[]>([]);
  const [volunteerCount, setVolunteerCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchData = async () => {
    try {
      const [eventsRes, statsRes] = await Promise.all([
        fetch('/api/surge-events?status=ACTIVE'),
        fetch('/api/stats'),
      ]);
      if (eventsRes.ok) setEvents(await eventsRes.json());
      if (statsRes.ok) {
        const s = await statsRes.json();
        setVolunteerCount(s.availableVolunteers);
      }
      setLastUpdate(new Date());
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchData();

    const socket = getSocket();
    socket.on('surge:created', fetchData);
    socket.on('surge:mobilized', fetchData);
    socket.on('surge:auto-triggered', fetchData);
    socket.on('deployment:updated', fetchData);

    return () => {
      socket.off('surge:created', fetchData);
      socket.off('surge:mobilized', fetchData);
      socket.off('surge:auto-triggered', fetchData);
      socket.off('deployment:updated', fetchData);
    };
  }, []);

  return (
    <div className="h-screen bg-slate-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex-shrink-0 bg-slate-900/95 backdrop-blur border-b border-slate-700/50 px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">CS</span>
            </div>
            <span className="text-white font-bold">
              Civic<span className="text-blue-400">Surge</span>
            </span>
          </Link>
          <div className="hidden sm:flex items-center gap-1.5 text-green-400 text-xs">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
            </span>
            LIVE CITY DASHBOARD
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="hidden sm:flex items-center gap-4">
            <div className="text-center">
              <div className="text-white font-bold">{volunteerCount}</div>
              <div className="text-xs text-slate-400">Available</div>
            </div>
            <div className="text-center">
              <div
                className={`font-bold ${events.length > 0 ? 'text-red-400 animate-pulse' : 'text-white'}`}
              >
                {events.length}
              </div>
              <div className="text-xs text-slate-400">Active Events</div>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Updated {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Map + sidebar layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Full map */}
        <div className="flex-1 relative">
          <LiveMap height="100%" showVolunteers />
        </div>

        {/* Events sidebar */}
        {events.length > 0 && (
          <div className="hidden lg:flex flex-col w-80 bg-slate-900/95 backdrop-blur border-l border-slate-700/50 overflow-y-auto">
            <div className="p-4 border-b border-slate-700/50">
              <h2 className="font-bold text-white flex items-center gap-2">
                <span className="animate-pulse">🔴</span>
                Active Emergencies ({events.length})
              </h2>
            </div>
            <div className="p-3 space-y-3">
              {events.map((evt) => {
                const pct =
                  evt.headcount > 0
                    ? Math.round((evt.filledCount / evt.headcount) * 100)
                    : 0;

                return (
                  <div
                    key={evt.id}
                    className="bg-red-900/15 border border-red-700/30 rounded-xl p-4"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-xl">
                        {EVENT_TYPE_ICONS[evt.type as keyof typeof EVENT_TYPE_ICONS] ?? '⚠️'}
                      </span>
                      <div>
                        <h3 className="font-semibold text-white text-sm leading-tight">
                          {evt.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-red-400">{evt.type}</span>
                          {evt.autoTriggered && (
                            <span className="text-xs text-blue-400">IoT</span>
                          )}
                          <span className="text-xs text-slate-500">{evt.radiusKm} km radius</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs mb-1">
                      <div className="flex justify-between text-slate-400 mb-0.5">
                        <span>Coverage</span>
                        <span
                          className={
                            pct >= 80
                              ? 'text-green-400'
                              : pct >= 50
                              ? 'text-amber-400'
                              : 'text-red-400'
                          }
                        >
                          {evt.filledCount}/{evt.headcount} filled
                        </span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-1">
                        <div
                          className={`h-1 rounded-full ${
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

                    <div className="mt-2 text-xs text-slate-500">
                      {new Date(evt.createdAt).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA bar */}
      <div className="flex-shrink-0 bg-slate-900/95 backdrop-blur border-t border-slate-700/50 px-4 py-2 flex items-center justify-center gap-4">
        <p className="text-slate-400 text-sm">Are you a volunteer?</p>
        <Link
          href="/auth/register"
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
        >
          Register Now
        </Link>
        <Link
          href="/auth/login"
          className="text-slate-400 hover:text-slate-300 text-sm transition-colors"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}
