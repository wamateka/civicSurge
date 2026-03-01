'use client';

import { useState, useEffect } from 'react';
import { AVAILABLE_SKILLS, AVAILABLE_RESOURCES, EVENT_TYPE_ICONS } from '@/types';
import type { SurgeEventData } from '@/types';

interface Volunteer {
  id: string;
  phone: string;
  distanceKm?: number;
  skills: string[];
  user: { id: string; name: string; email: string };
}

interface Deployment {
  id: string;
  volunteerId: string;
  distanceKm: number;
  status: 'NOTIFIED' | 'ACCEPTED' | 'DECLINED' | 'TIMED_OUT' | 'CHECKED_IN';
  notifiedAt: string;
  respondedAt: string | null;
  volunteer: Volunteer;
}

interface EventDetail extends SurgeEventData {
  deployments: Deployment[];
}

interface Props {
  eventId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

type FilterTab = 'ALL' | 'ACCEPTED' | 'NOTIFIED' | 'DECLINED' | 'TIMED_OUT' | 'CHECKED_IN';

const STATUS_STYLES: Record<string, string> = {
  NOTIFIED:   'bg-amber-900/40 text-amber-300 border-amber-700/50',
  ACCEPTED:   'bg-green-900/40 text-green-300 border-green-700/50',
  DECLINED:   'bg-red-900/40 text-red-300 border-red-700/50',
  TIMED_OUT:  'bg-slate-800/60 text-slate-500 border-slate-600/50',
  CHECKED_IN: 'bg-blue-900/40 text-blue-300 border-blue-700/50',
};

const STATUS_LABELS: Record<string, string> = {
  NOTIFIED:   'Notified',
  ACCEPTED:   'Accepted',
  DECLINED:   'Declined',
  TIMED_OUT:  'Timed Out',
  CHECKED_IN: 'Checked In',
};

export default function SurgeEventDetailModal({ eventId, onClose, onUpdated }: Props) {
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('ALL');

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSeverity, setEditSeverity] = useState(3);
  const [editHeadcount, setEditHeadcount] = useState(10);
  const [editSkills, setEditSkills] = useState<string[]>([]);
  const [editResources, setEditResources] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!eventId) {
      setEvent(null);
      return;
    }
    setLoading(true);
    setEditing(false);
    setFilter('ALL');
    setSaveError('');

    fetch(`/api/surge-events/${eventId}`)
      .then((r) => r.json())
      .then((data: EventDetail) => {
        setEvent(data);
        setEditTitle(data.title);
        setEditSeverity(data.severity);
        setEditHeadcount(data.headcount);
        setEditSkills(data.skillsNeeded);
        setEditResources(data.resourcesNeeded ?? []);
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  if (!eventId) return null;

  const deployments = event?.deployments ?? [];

  const counts: Record<FilterTab, number> = {
    ALL:        deployments.length,
    NOTIFIED:   deployments.filter((d) => d.status === 'NOTIFIED').length,
    ACCEPTED:   deployments.filter((d) => d.status === 'ACCEPTED').length,
    DECLINED:   deployments.filter((d) => d.status === 'DECLINED').length,
    TIMED_OUT:  deployments.filter((d) => d.status === 'TIMED_OUT').length,
    CHECKED_IN: deployments.filter((d) => d.status === 'CHECKED_IN').length,
  };

  const filtered = filter === 'ALL' ? deployments : deployments.filter((d) => d.status === filter);

  const toggleSkill = (skill: string) =>
    setEditSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );

  const toggleResource = (resource: string) =>
    setEditResources((prev) =>
      prev.includes(resource) ? prev.filter((r) => r !== resource) : [...prev, resource]
    );

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`/api/surge-events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          severity: editSeverity,
          headcount: editHeadcount,
          skillsNeeded: editSkills,
          resourcesNeeded: editResources,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setSaveError(d.error ?? 'Failed to save changes');
        return;
      }
      const updated = await res.json();
      setEvent((prev) => (prev ? { ...prev, ...updated } : prev));
      setEditing(false);
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  const handleCloseEvent = async () => {
    setClosing(true);
    await fetch(`/api/surge-events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' }),
    });
    setClosing(false);
    onUpdated();
    onClose();
  };

  const icon = event
    ? (EVENT_TYPE_ICONS[event.type as keyof typeof EVENT_TYPE_ICONS] ?? '⚠️')
    : '⚠️';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Side panel */}
      <div className="relative w-full max-w-2xl h-full bg-slate-900 border-l border-slate-700/50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-700/50 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-3xl flex-shrink-0">{icon}</span>
            <div className="min-w-0">
              {loading ? (
                <div className="h-5 w-52 bg-slate-700 rounded animate-pulse" />
              ) : (
                <h2 className="font-bold text-white text-lg leading-tight truncate">
                  {event?.title}
                </h2>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {event?.autoTriggered && (
                  <span className="text-xs bg-blue-900/40 text-blue-300 border border-blue-700/50 px-2 py-0.5 rounded">
                    IoT Auto
                  </span>
                )}
                <span className="text-xs text-slate-400">{event?.type}</span>
                <span className="text-xs text-slate-600">·</span>
                <span className="text-xs text-slate-500">
                  {event ? new Date(event.createdAt).toLocaleString() : ''}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 flex-shrink-0 ml-3"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-slate-500 text-sm animate-pulse">Loading event details...</div>
          </div>
        ) : event ? (
          <div className="flex-1 overflow-y-auto">
            {/* Quick stats row */}
            <div className="grid grid-cols-4 divide-x divide-slate-700/50 border-b border-slate-700/50">
              <div className="p-3 text-center">
                <div className="text-white font-bold text-sm tracking-wider">
                  {Array.from({ length: event.severity }).map((_, i) => (
                    <span key={i} className="text-amber-400">●</span>
                  ))}
                  {Array.from({ length: 5 - event.severity }).map((_, i) => (
                    <span key={i} className="text-slate-600">●</span>
                  ))}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Severity</div>
              </div>
              <div className="p-3 text-center">
                <div className="text-white font-bold text-sm">{event.filledCount}/{event.headcount}</div>
                <div className="text-xs text-slate-500 mt-0.5">Coverage</div>
              </div>
              <div className="p-3 text-center">
                <div className="text-green-400 font-bold text-sm">{counts.ACCEPTED}</div>
                <div className="text-xs text-slate-500 mt-0.5">Accepted</div>
              </div>
              <div className="p-3 text-center">
                <div className="text-red-400 font-bold text-sm">{counts.DECLINED}</div>
                <div className="text-xs text-slate-500 mt-0.5">Declined</div>
              </div>
            </div>

            {/* Event details / edit section */}
            <div className="p-4 border-b border-slate-700/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-300">Event Details</h3>
                <div className="flex gap-2">
                  {!editing ? (
                    <button
                      onClick={() => setEditing(true)}
                      className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => { setEditing(false); setSaveError(''); }}
                        className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </>
                  )}
                  <button
                    onClick={handleCloseEvent}
                    disabled={closing}
                    className="text-xs bg-slate-800 hover:bg-red-900/40 border border-slate-600 hover:border-red-700/50 text-slate-400 hover:text-red-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {closing ? 'Closing...' : 'Close Event'}
                  </button>
                </div>
              </div>

              {saveError && (
                <div className="mb-3 text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2">
                  {saveError}
                </div>
              )}

              {editing ? (
                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="text-xs font-medium text-slate-400 mb-1 block uppercase tracking-wider">
                      Title
                    </label>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Severity */}
                  <div>
                    <label className="text-xs font-medium text-slate-400 mb-1 block uppercase tracking-wider">
                      Severity:{' '}
                      <span className="text-amber-400 font-bold normal-case">{editSeverity}/5</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={editSeverity}
                      onChange={(e) => setEditSeverity(parseInt(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-slate-600 mt-0.5">
                      <span>Minor</span>
                      <span>Critical</span>
                    </div>
                  </div>

                  {/* Headcount */}
                  <div>
                    <label className="text-xs font-medium text-slate-400 mb-1 block uppercase tracking-wider">
                      Headcount Needed
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={editHeadcount}
                      onChange={(e) => setEditHeadcount(parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Skills */}
                  <div>
                    <label className="text-xs font-medium text-slate-400 mb-2 block uppercase tracking-wider">
                      Skills Needed{' '}
                      <span className="text-slate-500 normal-case">({editSkills.length} selected)</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {AVAILABLE_SKILLS.map((skill) => {
                        const selected = editSkills.includes(skill);
                        return (
                          <button
                            key={skill}
                            type="button"
                            onClick={() => toggleSkill(skill)}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                              selected
                                ? 'bg-blue-600/40 border-blue-500 text-blue-300'
                                : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500'
                            }`}
                          >
                            {skill}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Resources */}
                  <div>
                    <label className="text-xs font-medium text-slate-400 mb-2 block uppercase tracking-wider">
                      Equipment Needed{' '}
                      <span className="text-slate-500 normal-case">({editResources.length} selected)</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {AVAILABLE_RESOURCES.map((resource) => {
                        const selected = editResources.includes(resource);
                        return (
                          <button
                            key={resource}
                            type="button"
                            onClick={() => toggleResource(resource)}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                              selected
                                ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                                : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500'
                            }`}
                          >
                            {resource}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Type</span>
                    <span className="text-slate-200">{event.type}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Headcount</span>
                    <span className="text-slate-200">{event.headcount}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Radius</span>
                    <span className="text-slate-200">{event.radiusKm} km</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Filled</span>
                    <span className="text-slate-200">{event.filledCount} / {event.headcount}</span>
                  </div>
                  <div className="col-span-2 flex gap-2 flex-wrap pt-1">
                    <span className="text-slate-500 flex-shrink-0">Skills:</span>
                    <span className="text-slate-300">
                      {event.skillsNeeded.length > 0 ? event.skillsNeeded.join(', ') : '—'}
                    </span>
                  </div>
                  <div className="col-span-2 flex gap-2 flex-wrap">
                    <span className="text-slate-500 flex-shrink-0">Equipment:</span>
                    <span className="text-slate-300">
                      {(event.resourcesNeeded ?? []).length > 0 ? event.resourcesNeeded.join(', ') : '—'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Volunteer roster */}
            <div className="p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">
                Volunteer Roster{' '}
                <span className="text-slate-500 font-normal">({deployments.length} notified)</span>
              </h3>

              {/* Filter tabs */}
              <div className="flex gap-1 mb-3 flex-wrap">
                {(['ALL', 'ACCEPTED', 'NOTIFIED', 'DECLINED', 'TIMED_OUT', 'CHECKED_IN'] as FilterTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setFilter(tab)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      filter === tab
                        ? 'bg-slate-600 border-slate-500 text-white'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {tab === 'ALL' ? 'All' : STATUS_LABELS[tab]} ({counts[tab]})
                  </button>
                ))}
              </div>

              {/* List */}
              {filtered.length === 0 ? (
                <div className="text-center text-slate-500 text-sm py-10">
                  No volunteers in this category
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((dep) => (
                    <div
                      key={dep.id}
                      className="flex items-center gap-3 bg-slate-800/50 border border-slate-700/40 rounded-xl px-3 py-2.5"
                    >
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-300 flex-shrink-0">
                        {dep.volunteer?.user?.name?.[0]?.toUpperCase() ?? '?'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {dep.volunteer?.user?.name ?? 'Unknown'}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {dep.volunteer?.user?.email}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          {dep.distanceKm.toFixed(1)} km away
                          {dep.respondedAt &&
                            ` · Responded ${new Date(dep.respondedAt).toLocaleTimeString()}`}
                        </div>
                      </div>

                      <span
                        className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 ${STATUS_STYLES[dep.status]}`}
                      >
                        {STATUS_LABELS[dep.status]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-slate-500 text-sm">Event not found</div>
          </div>
        )}
      </div>
    </div>
  );
}
