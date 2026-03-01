'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import StatsBar from '@/components/StatsBar';
import SurgeEventForm from '@/components/SurgeEventForm';
import DeploymentFeed from '@/components/DeploymentFeed';
import SensorSimulator from '@/components/SensorSimulator';
import SurgeEventDetailModal from '@/components/SurgeEventDetailModal';
import { getSocket } from '@/lib/socket';
import { EVENT_TYPE_ICONS } from '@/types';

const LiveMap = dynamic(() => import('@/components/LiveMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-800/50 rounded-xl animate-pulse flex items-center justify-center">
      <span className="text-slate-500 text-sm">Loading map...</span>
    </div>
  ),
});

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
  createdAt: string;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'overview' | 'declare' | 'sensors'>('overview');
  const [events, setEvents] = useState<SurgeEvent[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/login');
    if (status === 'authenticated' && session.user.role !== 'ADMIN') {
      router.push('/dashboard/volunteer');
    }
  }, [status, session, router]);

  const loadData = async () => {
    try {
      const eventsRes = await fetch('/api/surge-events?status=ACTIVE');
      if (eventsRes.ok) setEvents(await eventsRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      loadData();
    }
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const socket = getSocket();
    socket.emit('join:admin');

    const handleSurgeCreated = (data: any) => {
      const icon = EVENT_TYPE_ICONS[data.surgeEvent.type as keyof typeof EVENT_TYPE_ICONS] ?? '⚠️';
      addNotification(`${icon} New event: ${data.surgeEvent.title}`);
      loadData();
    };

    const handleMobilized = (data: any) => {
      addNotification(`Mobilized — ${data.matched ?? 0} volunteers notified`);
      loadData();
    };

    const handleDeploymentUpdated = (data: any) => {
      const d = data.deployment;
      const statusEmoji = d.status === 'ACCEPTED' ? '[Y]' : d.status === 'DECLINED' ? '[N]' : '[*]';
      addNotification(
        `${statusEmoji} ${d.volunteer?.user?.name ?? 'Volunteer'} ${d.status.toLowerCase()}`
      );
      loadData();
    };

    const handleAutoTrigger = (data: any) => {
      addNotification(`[AUTO] IoT AUTO-TRIGGER: ${data.sensorType} exceeded threshold`);
      loadData();
    };

    socket.on('surge:created', handleSurgeCreated);
    socket.on('surge:mobilized', handleMobilized);
    socket.on('deployment:updated', handleDeploymentUpdated);
    socket.on('surge:auto-triggered', handleAutoTrigger);

    return () => {
      socket.off('surge:created', handleSurgeCreated);
      socket.off('surge:mobilized', handleMobilized);
      socket.off('deployment:updated', handleDeploymentUpdated);
      socket.off('surge:auto-triggered', handleAutoTrigger);
    };
  }, [status]);

  const addNotification = (msg: string) => {
    setNotifications((prev) => [msg, ...prev].slice(0, 8));
  };

  const handleEventCreated = (event: any) => {
    const icon = EVENT_TYPE_ICONS[event.type as keyof typeof EVENT_TYPE_ICONS] ?? '⚠️';
    addNotification(`${icon} Created & mobilized: ${event.title}`);
    if (event.mobilizeResult) {
      addNotification(`Mobilized ${event.mobilizeResult.matched ?? 0} volunteers`);
    }
    setActiveTab('overview');
    loadData();
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Loading command center...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <span className="text-red-400">🚨</span> CivicSurge Command Center
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Real-time emergency volunteer coordination
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <span className="text-green-400 text-sm font-medium">SYSTEM ONLINE</span>
          </div>
        </div>

        {/* Stats bar */}
        <StatsBar />

        {/* Live notifications ticker */}
        {notifications.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-3 flex items-center gap-3 overflow-hidden">
            <span className="text-amber-400 text-xs font-bold flex-shrink-0">LIVE</span>
            <div className="text-sm text-slate-300 truncate">{notifications[0]}</div>
            {notifications.length > 1 && (
              <span className="text-slate-500 text-xs flex-shrink-0">+{notifications.length - 1} more</span>
            )}
          </div>
        )}

        {/* Main content tabs */}
        <div className="flex gap-2 border-b border-slate-700/50">
          {[
            { id: 'overview', label: 'Overview & Map', count: events.length },
            { id: 'declare', label: 'Declare Event' },
            { id: 'sensors', label: 'IoT Sensors' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400 bg-slate-800/50'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-2 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div className="grid xl:grid-cols-3 gap-6">
            {/* Map (2/3 width) */}
            <div className="xl:col-span-2 space-y-4">
              <div className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <h2 className="font-bold text-white flex items-center gap-2">
                    Live Deployment Map
                  </h2>
                  <span className="text-xs text-green-400 flex items-center gap-1">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                    </span>
                    Real-time
                  </span>
                </div>
                <LiveMap height="500px" showVolunteers adminMode />
              </div>

              {/* Active events */}
              {events.length > 0 && (
                <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4">
                  <h2 className="font-bold text-white mb-3 flex items-center gap-2">
                    <span className="animate-pulse text-red-400">●</span> Active Surge Events ({events.length})
                  </h2>
                  <div className="space-y-3">
                    {events.map((evt) => (
                      <button
                        key={evt.id}
                        onClick={() => setSelectedEventId(evt.id)}
                        className="w-full text-left bg-red-900/10 border border-red-700/30 hover:border-red-600/50 hover:bg-red-900/20 rounded-xl p-4 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">
                                {EVENT_TYPE_ICONS[evt.type as keyof typeof EVENT_TYPE_ICONS] ?? '⚠️'}
                              </span>
                              <span className="font-bold text-white">{evt.title}</span>
                              {evt.autoTriggered && (
                                <span className="text-xs bg-blue-900/40 text-blue-300 border border-blue-700/50 px-2 py-0.5 rounded">
                                  IoT
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400">
                              Severity: {Array.from({ length: evt.severity }).map((_, i) => <span key={i}>●</span>)}
                              {Array.from({ length: 5 - evt.severity }).map((_, i) => <span key={i}>○</span>)}
                              &nbsp;·&nbsp;Radius: {evt.radiusKm}km
                              &nbsp;·&nbsp;{new Date(evt.createdAt).toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              Coverage: {evt.filledCount}/{evt.headcount} volunteers filled
                            </div>
                          </div>
                          <span className="text-xs text-slate-500 group-hover:text-slate-300 transition-colors flex-shrink-0 ml-3">
                            View details →
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right sidebar (1/3 width) */}
            <div className="space-y-4">
              {/* Deployment feed */}
              <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4">
                <h2 className="font-bold text-white mb-3 flex items-center gap-2">
                  Deployment Feed
                </h2>
                <DeploymentFeed maxItems={15} />
              </div>

              {/* Active events summary */}
              {events.length > 0 && (
                <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4">
                  <h2 className="font-bold text-white mb-3">Event Coverage</h2>
                  <div className="space-y-3">
                    {events.map((evt) => {
                      const pct = evt.headcount > 0 ? Math.round((evt.filledCount / evt.headcount) * 100) : 0;
                      return (
                        <div key={evt.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300 truncate max-w-[70%]">{evt.title}</span>
                            <span className="text-slate-400">{evt.filledCount}/{evt.headcount}</span>
                          </div>
                          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Declare event tab */}
        {activeTab === 'declare' && (
          <div className="max-w-2xl">
            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <span>🚨</span> Declare Surge Event
              </h2>
              <p className="text-slate-400 text-sm mb-6">
                Create an emergency event and instantly mobilize matched volunteers.
              </p>
              <SurgeEventForm onSuccess={handleEventCreated} />
            </div>
          </div>
        )}

        {/* IoT sensors tab */}
        {activeTab === 'sensors' && (
          <div className="max-w-xl">
            <p className="text-slate-400 text-sm mb-4">
              Simulate IoT sensor readings. When values exceed thresholds, surge events are
              auto-created and volunteers are mobilized — no admin action required.
            </p>
            <SensorSimulator />
          </div>
        )}
      </div>

      {/* Event detail modal */}
      <SurgeEventDetailModal
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
        onUpdated={() => { loadData(); }}
      />
    </div>
  );
}
