'use client';

import { useState } from 'react';
import { EVENT_TYPE_ICONS, EVENT_TYPE_COLORS } from '@/types';

interface Deployment {
  id: string;
  distanceKm?: number;
  status: string;
  notifiedAt: string;
  surgeEvent: {
    id: string;
    title: string;
    type: string;
    severity: number;
    autoTriggered: boolean;
  };
  volunteer?: {
    skills: string[];
  };
}

interface VolunteerAlertProps {
  deployment: Deployment;
  onRespond: (deploymentId: string, action: 'ACCEPTED' | 'DECLINED') => void;
}

export default function VolunteerAlert({ deployment, onRespond }: VolunteerAlertProps) {
  const [responding, setResponding] = useState(false);
  const [responded, setResponded] = useState<string | null>(null);

  const eventType = deployment.surgeEvent.type as keyof typeof EVENT_TYPE_ICONS;
  const icon = EVENT_TYPE_ICONS[eventType] ?? '⚠️';
  const color = EVENT_TYPE_COLORS[eventType] ?? '#f59e0b';

  const timeAgo = (() => {
    const diff = Date.now() - new Date(deployment.notifiedAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  })();

  const handleRespond = async (action: 'ACCEPTED' | 'DECLINED') => {
    setResponding(true);
    try {
      const res = await fetch(`/api/deployments/${deployment.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setResponded(action);
        onRespond(deployment.id, action);
      }
    } finally {
      setResponding(false);
    }
  };

  if (responded) {
    return (
      <div
        className={`rounded-xl border p-4 ${
          responded === 'ACCEPTED'
            ? 'bg-green-900/20 border-green-700/50'
            : 'bg-slate-800/50 border-slate-700/50 opacity-60'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{responded === 'ACCEPTED' ? '✅' : '❌'}</span>
          <span
            className={`text-sm font-medium ${
              responded === 'ACCEPTED' ? 'text-green-400' : 'text-slate-400'
            }`}
          >
            {responded === 'ACCEPTED'
              ? 'You accepted this deployment'
              : 'You declined this deployment'}
          </span>
        </div>
      </div>
    );
  }

  if (deployment.status !== 'NOTIFIED') {
    return null;
  }

  return (
    <div
      className="rounded-xl border-2 p-5 relative overflow-hidden"
      style={{ borderColor: color + '80', background: color + '10' }}
    >
      {/* Pulsing indicator */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </span>
        <span className="text-xs text-slate-400">{timeAgo}</span>
      </div>

      {/* Event info */}
      <div className="flex items-start gap-3 mb-4">
        <span className="text-3xl">{icon}</span>
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider"
              style={{ color, background: color + '25' }}
            >
              {deployment.surgeEvent.type}
            </span>
            {deployment.surgeEvent.autoTriggered && (
              <span className="text-xs bg-slate-700/60 text-slate-300 border border-slate-600/50 px-2 py-0.5 rounded">
                IoT Triggered
              </span>
            )}
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className={`text-xs ${
                  i < deployment.surgeEvent.severity ? 'text-amber-400' : 'text-slate-700'
                }`}
              >
                ●
              </span>
            ))}
          </div>
          <h3 className="font-bold text-white text-base leading-tight">
            {deployment.surgeEvent.title}
          </h3>
          {deployment.distanceKm != null && (
            <p className="text-slate-400 text-sm mt-0.5">
              You are{' '}
              <span className="text-white font-semibold">
                {deployment.distanceKm.toFixed(1)} km
              </span>{' '}
              from the emergency
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => handleRespond('ACCEPTED')}
          disabled={responding}
          className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {responding ? <span className="animate-spin">⟳</span> : <>✅ ACCEPT</>}
        </button>
        <button
          onClick={() => handleRespond('DECLINED')}
          disabled={responding}
          className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          ❌ DECLINE
        </button>
      </div>
    </div>
  );
}
