'use client';

import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';

interface Stats {
  totalVolunteers: number;
  availableVolunteers: number;
  activeEvents: number;
  totalDeployments: number;
  acceptedDeployments: number;
  coveragePct: number;
}

export default function StatsBar() {
  const [stats, setStats] = useState<Stats>({
    totalVolunteers: 0,
    availableVolunteers: 0,
    activeEvents: 0,
    totalDeployments: 0,
    acceptedDeployments: 0,
    coveragePct: 0,
  });

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) setStats(await res.json());
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchStats();

    const socket = getSocket();
    const refresh = () => fetchStats();

    socket.on('surge:created', refresh);
    socket.on('surge:mobilized', refresh);
    socket.on('deployment:updated', refresh);
    socket.on('surge:auto-triggered', refresh);

    return () => {
      socket.off('surge:created', refresh);
      socket.off('surge:mobilized', refresh);
      socket.off('deployment:updated', refresh);
      socket.off('surge:auto-triggered', refresh);
    };
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard
        label="Total Volunteers"
        value={stats.totalVolunteers}
        color="blue"
        icon="👥"
      />
      <StatCard
        label="Available Now"
        value={stats.availableVolunteers}
        color="green"
        icon="✅"
      />
      <StatCard
        label="Active Events"
        value={stats.activeEvents}
        color={stats.activeEvents > 0 ? 'red' : 'slate'}
        icon="🚨"
        pulse={stats.activeEvents > 0}
      />
      <StatCard
        label="Deployed"
        value={stats.totalDeployments}
        color="amber"
        icon="🏃"
      />
      <StatCard
        label="Confirmed"
        value={stats.acceptedDeployments}
        color="green"
        icon="✔️"
      />
      <StatCard
        label="Coverage"
        value={`${stats.coveragePct}%`}
        color={stats.coveragePct >= 80 ? 'green' : stats.coveragePct >= 50 ? 'amber' : 'red'}
        icon="📊"
      />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number | string;
  color: 'blue' | 'green' | 'red' | 'amber' | 'slate';
  icon: string;
  pulse?: boolean;
}

function StatCard({ label, value, color, icon, pulse }: StatCardProps) {
  const colorMap = {
    blue: 'border-blue-700/50 bg-blue-900/20 text-blue-400',
    green: 'border-green-700/50 bg-green-900/20 text-green-400',
    red: 'border-red-700/50 bg-red-900/20 text-red-400',
    amber: 'border-amber-700/50 bg-amber-900/20 text-amber-400',
    slate: 'border-slate-700/50 bg-slate-800/50 text-slate-400',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}
