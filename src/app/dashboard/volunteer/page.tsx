'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import VolunteerAlert from '@/components/VolunteerAlert';
import SkillBadge from '@/components/SkillBadge';
import { getSocket } from '@/lib/socket';

interface Deployment {
  id: string;
  distanceKm: number;
  status: string;
  notifiedAt: string;
  respondedAt: string | null;
  surgeEvent: {
    id: string;
    title: string;
    type: string;
    severity: number;
    autoTriggered: boolean;
    status: string;
  };
  volunteer?: {
    skills: string[];
  };
}

interface VolunteerProfile {
  id: string;
  phone: string;
  latitude: number;
  longitude: number;
  address: string | null;
  skills: string[];
  resources: string[];
  isAvailable: boolean;
  user: { name: string; email: string };
  deployments: Deployment[];
}

export default function VolunteerDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<VolunteerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/login');
    if (status === 'authenticated' && session.user.role !== 'VOLUNTEER') {
      router.push('/dashboard/admin');
    }
  }, [status, session, router]);

  const loadProfile = async () => {
    try {
      const res = await fetch('/api/volunteers/me');
      if (res.ok) setProfile(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'VOLUNTEER') {
      loadProfile();
    }
  }, [status, session]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return;
    const socket = getSocket();
    socket.emit('join:volunteer', session.user.id);

    const handleMobilized = (data: any) => {
      const mine = data.deployments?.find((d: any) => d.volunteer?.userId === session.user.id);
      if (mine) loadProfile();
    };

    socket.on('surge:mobilized', handleMobilized);
    socket.on('deployment:updated', loadProfile);
    return () => {
      socket.off('surge:mobilized', handleMobilized);
      socket.off('deployment:updated', loadProfile);
    };
  }, [status, session]);

  const toggleAvailability = async () => {
    if (!profile) return;
    setTogglingAvailability(true);
    try {
      const res = await fetch(`/api/volunteers/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !profile.isAvailable }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile((p) => (p ? { ...p, isAvailable: updated.isAvailable } : p));
      }
    } finally {
      setTogglingAvailability(false);
    }
  };

  const handleRespond = (deploymentId: string, action: 'ACCEPTED' | 'DECLINED') => {
    setProfile((p) => {
      if (!p) return p;
      return {
        ...p,
        deployments: p.deployments.map((d) =>
          d.id === deploymentId ? { ...d, status: action } : d
        ),
      };
    });
  };

  const activeDeployments =
    profile?.deployments.filter(
      (d) => d.status === 'NOTIFIED' && d.surgeEvent.status === 'ACTIVE'
    ) ?? [];
  const pastDeployments = profile?.deployments.filter((d) => d.status !== 'NOTIFIED') ?? [];

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-black text-white">Volunteer Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Welcome back, {session?.user?.name}</p>
        </div>

        {/* Profile card */}
        {profile ? (
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-bold text-white text-lg">{profile.user.name}</h2>
                <p className="text-slate-400 text-sm">{profile.user.email}</p>
                {profile.phone && <p className="text-slate-400 text-sm">{profile.phone}</p>}
              </div>
              <div className="text-center">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-slate-400">On-call</span>
                  <button
                    onClick={toggleAvailability}
                    disabled={togglingAvailability}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      profile.isAvailable ? 'bg-green-600' : 'bg-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                        profile.isAvailable ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <p
                  className={`text-xs ${profile.isAvailable ? 'text-green-400' : 'text-slate-500'}`}
                >
                  {profile.isAvailable ? 'Available' : 'Off-duty'}
                </p>
              </div>
            </div>

            {/* Location info */}
            {(profile.address || (profile.latitude !== 0 && profile.longitude !== 0)) && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-slate-400 text-xs">📍</span>
                <span className="text-sm text-slate-300">
                  {profile.address || `${profile.latitude.toFixed(4)}, ${profile.longitude.toFixed(4)}`}
                </span>
              </div>
            )}

            <div>
              <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Your Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((skill) => (
                  <SkillBadge key={skill} skill={skill} />
                ))}
              </div>
            </div>

            {profile.resources && profile.resources.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Your Equipment</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.resources.map((resource) => (
                    <span
                      key={resource}
                      className="text-xs px-2.5 py-1 rounded-full border bg-amber-900/20 border-amber-700/50 text-amber-300"
                    >
                      {resource}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 text-center">
            <p className="text-slate-400 text-sm">Volunteer profile not found.</p>
          </div>
        )}

        {/* Active alerts */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-bold text-white text-lg">Active Alerts</h2>
            {activeDeployments.length > 0 && (
              <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                {activeDeployments.length}
              </span>
            )}
          </div>
          {activeDeployments.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-6 text-center">
              <div className="text-3xl mb-2">🟢</div>
              <p className="text-slate-400 text-sm">No active mobilization requests</p>
              <p className="text-slate-500 text-xs mt-1">
                {profile?.isAvailable
                  ? "You'll be notified when an emergency needs your skills."
                  : 'Toggle availability above to receive deployment alerts.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeDeployments.map((d) => (
                <VolunteerAlert key={d.id} deployment={d} onRespond={handleRespond} />
              ))}
            </div>
          )}
        </div>

        {/* Deployment history */}
        {pastDeployments.length > 0 && (
          <div>
            <h2 className="font-bold text-white text-lg mb-3">Deployment History</h2>
            <div className="space-y-2">
              {pastDeployments.slice(0, 10).map((d) => {
                const statusColors: Record<string, string> = {
                  ACCEPTED: 'text-green-400',
                  DECLINED: 'text-red-400',
                  TIMED_OUT: 'text-slate-500',
                  CHECKED_IN: 'text-blue-400',
                };
                const statusIcons: Record<string, string> = {
                  ACCEPTED: '✅',
                  DECLINED: '❌',
                  TIMED_OUT: '⏱️',
                  CHECKED_IN: '📍',
                };
                return (
                  <div
                    key={d.id}
                    className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{statusIcons[d.status] ?? '•'}</span>
                      <div>
                        <p className="text-sm font-medium text-white">{d.surgeEvent.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(d.notifiedAt).toLocaleDateString()} · {d.surgeEvent.type}
                          {d.surgeEvent.autoTriggered && ' · IoT'}
                          {d.distanceKm > 0 && ` · ${d.distanceKm.toFixed(1)} km away`}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-semibold ${statusColors[d.status] ?? 'text-slate-400'}`}
                    >
                      {d.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
