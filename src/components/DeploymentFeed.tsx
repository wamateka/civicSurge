'use client';

import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';

interface FeedItem {
  id: string;
  deploymentId: string;
  volunteerName: string;
  distanceKm: number;
  eventTitle: string;
  status: string;
  respondedAt: string | null;
  timestamp: string;
}

const STATUS_CONFIG = {
  NOTIFIED: { label: 'Notified', color: 'text-amber-400', bg: 'bg-amber-900/30 border-amber-700/50', icon: '🔔' },
  ACCEPTED: { label: 'Accepted', color: 'text-green-400', bg: 'bg-green-900/30 border-green-700/50', icon: '✅' },
  DECLINED: { label: 'Declined', color: 'text-red-400', bg: 'bg-red-900/30 border-red-700/50', icon: '❌' },
  CHECKED_IN: { label: 'Checked In', color: 'text-blue-400', bg: 'bg-blue-900/30 border-blue-700/50', icon: '📍' },
};

interface DeploymentFeedProps {
  surgeEventId?: string;
  maxItems?: number;
}

export default function DeploymentFeed({ surgeEventId, maxItems = 20 }: DeploymentFeedProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDeployments = async () => {
    try {
      const url = surgeEventId
        ? `/api/deployments?surgeEventId=${surgeEventId}`
        : '/api/deployments';
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();

      const feed: FeedItem[] = data.slice(0, maxItems).map((d: any) => ({
        id: d.id,
        deploymentId: d.id,
        volunteerName: d.volunteer?.user?.name ?? 'Unknown',
        distanceKm: d.distanceKm ?? 0,
        eventTitle: d.surgeEvent?.title ?? 'Unknown Event',
        status: d.status,
        respondedAt: d.respondedAt,
        timestamp: d.notifiedAt,
      }));

      setItems(feed);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeployments();

    const socket = getSocket();

    const handleDeploymentUpdated = (data: { deployment: any }) => {
      const d = data.deployment;
      const item: FeedItem = {
        id: d.id,
        deploymentId: d.id,
        volunteerName: d.volunteer?.user?.name ?? 'Unknown',
        distanceKm: d.distanceKm ?? 0,
        eventTitle: d.surgeEvent?.title ?? 'Unknown Event',
        status: d.status,
        respondedAt: d.respondedAt,
        timestamp: d.notifiedAt,
      };

      setItems((prev) => {
        const existing = prev.findIndex((i) => i.id === item.id);
        if (existing !== -1) {
          const updated = [...prev];
          updated[existing] = item;
          return updated;
        }
        return [item, ...prev].slice(0, maxItems);
      });
    };

    const handleMobilized = (data: { surgeEventId: string; deployments: any[] }) => {
      if (surgeEventId && data.surgeEventId !== surgeEventId) return;
      loadDeployments();
    };

    socket.on('deployment:updated', handleDeploymentUpdated);
    socket.on('surge:mobilized', handleMobilized);

    return () => {
      socket.off('deployment:updated', handleDeploymentUpdated);
      socket.off('surge:mobilized', handleMobilized);
    };
  }, [surgeEventId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-slate-800/50 rounded-lg h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <div className="text-3xl mb-2">📭</div>
        <p className="text-sm">No deployments yet. Mobilize a surge event to see responses here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
      {items.map((item) => {
        const cfg = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.NOTIFIED;
        const timeAgo = (() => {
          const diff = Date.now() - new Date(item.timestamp).getTime();
          const mins = Math.floor(diff / 60000);
          if (mins < 1) return 'just now';
          if (mins < 60) return `${mins}m ago`;
          return `${Math.floor(mins / 60)}h ago`;
        })();

        return (
          <div
            key={item.id}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-all duration-300 ${cfg.bg}`}
          >
            <span className="text-lg flex-shrink-0">{cfg.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white truncate">{item.volunteerName}</span>
                <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
              </div>
              <div className="text-slate-400 text-xs truncate">
                {item.distanceKm > 0 ? `${item.distanceKm.toFixed(1)} km` : '—'} · {item.eventTitle}
              </div>
            </div>
            <span className="text-xs text-slate-500 flex-shrink-0">{timeAgo}</span>
          </div>
        );
      })}
    </div>
  );
}
