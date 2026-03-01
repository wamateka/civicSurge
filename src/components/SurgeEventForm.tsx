'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { AVAILABLE_SKILLS, AVAILABLE_RESOURCES, EVENT_TYPE_ICONS, EVENT_TYPE_SKILLS, EVENT_TYPE_RESOURCES } from '@/types';

const EpicenterMapPicker = dynamic(() => import('./EpicenterMapPicker'), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl bg-slate-800/50 border border-slate-600/50 flex items-center justify-center" style={{ height: '420px' }}>
      <span className="text-slate-500 text-sm animate-pulse">Loading map...</span>
    </div>
  ),
});

interface SurgeEventFormProps {
  onSuccess: (event: any) => void;
}

const EVENT_TYPES = ['FLOOD', 'TORNADO', 'SNOW', 'WILDFIRE', 'GENERAL'] as const;

export default function SurgeEventForm({ onSuccess }: SurgeEventFormProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<string>('FLOOD');
  const [severity, setSeverity] = useState(3);
  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);
  const [radiusKm, setRadiusKm] = useState(5);
  const [skillsNeeded, setSkillsNeeded] = useState<string[]>([]);
  const [resourcesNeeded, setResourcesNeeded] = useState<string[]>([]);
  const [headcount, setHeadcount] = useState(10);
  const [volunteerCount, setVolunteerCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mobilizeResult, setMobilizeResult] = useState<any>(null);
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [customResourceInput, setCustomResourceInput] = useState('');

  // Auto-suggest skills + resources when type changes
  useEffect(() => {
    setSkillsNeeded(EVENT_TYPE_SKILLS[type as keyof typeof EVENT_TYPE_SKILLS] ?? []);
    setResourcesNeeded(EVENT_TYPE_RESOURCES[type as keyof typeof EVENT_TYPE_RESOURCES] ?? []);
  }, [type]);

  // Count volunteers in radius
  useEffect(() => {
    if (latitude === 0 && longitude === 0) { setVolunteerCount(0); return; }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/volunteers?lat=${latitude}&lng=${longitude}&radiusKm=${radiusKm}&countOnly=true`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          setVolunteerCount(typeof data.count === 'number' ? data.count : 0);
        }
      } catch { /* ignore AbortError */ }
    }, 400);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [latitude, longitude, radiusKm]);

  const handleEpicenterChange = useCallback((lat: number, lng: number, radius: number) => {
    setLatitude(lat);
    setLongitude(lng);
    setRadiusKm(radius);
  }, []);

  const toggleSkill = (skill: string) =>
    setSkillsNeeded((prev) => prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]);

  const toggleResource = (resource: string) =>
    setResourcesNeeded((prev) => prev.includes(resource) ? prev.filter((r) => r !== resource) : [...prev, resource]);

  const addCustomSkill = () => {
    const val = customSkillInput.trim();
    if (val && !skillsNeeded.includes(val)) setSkillsNeeded((prev) => [...prev, val]);
    setCustomSkillInput('');
  };

  const addCustomResource = () => {
    const val = customResourceInput.trim();
    if (val && !resourcesNeeded.includes(val)) setResourcesNeeded((prev) => [...prev, val]);
    setCustomResourceInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) { setError('Title is required'); return; }
    if (latitude === 0 && longitude === 0) { setError('Please click the map to set an epicenter location'); return; }

    setSubmitting(true);
    setMobilizeResult(null);
    try {
      const createRes = await fetch('/api/surge-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, type, severity, latitude, longitude, radiusKm, skillsNeeded, resourcesNeeded, headcount }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        setError(data.error ?? 'Failed to create event');
        return;
      }

      const event = await createRes.json();

      const mobilizeRes = await fetch(`/api/surge-events/${event.id}/mobilize`, { method: 'POST' });
      const result = await mobilizeRes.json();

      setMobilizeResult(result);
      onSuccess({ ...event, mobilizeResult: result });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label className="text-xs font-medium text-slate-400 mb-1.5 block uppercase tracking-wider">Event Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Flash Flood — Lower East Side"
          className="w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500 text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Type + Severity */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block uppercase tracking-wider">Event Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{EVENT_TYPE_ICONS[t]} {t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block uppercase tracking-wider">
            Severity: <span className="text-amber-400 font-bold">{severity}/5</span>
          </label>
          <input
            type="range" min={1} max={5} value={severity}
            onChange={(e) => setSeverity(parseInt(e.target.value))}
            className="w-full mt-2 accent-amber-500 cursor-pointer"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-0.5">
            <span>Minor</span><span>Critical</span>
          </div>
        </div>
      </div>

      {/* Epicenter map */}
      <div>
        <label className="text-xs font-medium text-slate-400 mb-2 block uppercase tracking-wider">Epicenter &amp; Radius</label>
        <EpicenterMapPicker
          lat={latitude} lng={longitude} radiusKm={radiusKm}
          volunteerCount={volunteerCount} onChange={handleEpicenterChange}
        />
      </div>

      {/* Skills + Resources + Headcount */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {/* Skills */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-2 block uppercase tracking-wider">
              Skills Needed <span className="text-slate-500 normal-case">({skillsNeeded.length} selected — optional)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_SKILLS.map((skill) => {
                const selected = skillsNeeded.includes(skill);
                return (
                  <button
                    key={skill} type="button" onClick={() => toggleSkill(skill)}
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
              {/* Custom skills not in predefined list */}
              {skillsNeeded.filter((s) => !(AVAILABLE_SKILLS as readonly string[]).includes(s)).map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border bg-blue-600/40 border-blue-500 text-blue-300"
                >
                  {skill}
                  <button type="button" onClick={() => toggleSkill(skill)} className="text-blue-400 hover:text-white leading-none">×</button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <input
                type="text"
                value={customSkillInput}
                onChange={(e) => setCustomSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill(); } }}
                placeholder="Add a skill..."
                className="text-xs px-2.5 py-1 rounded-full border bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-36"
              />
              <button
                type="button"
                onClick={addCustomSkill}
                className="text-xs px-2.5 py-1 rounded-full border bg-slate-700 border-slate-600 text-slate-300 hover:border-blue-500 hover:text-blue-300 transition-all"
              >
                + Add
              </button>
            </div>
          </div>

          {/* Resources */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-2 block uppercase tracking-wider">
              Equipment Needed <span className="text-slate-500 normal-case">({resourcesNeeded.length} selected — optional)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_RESOURCES.map((resource) => {
                const selected = resourcesNeeded.includes(resource);
                return (
                  <button
                    key={resource} type="button" onClick={() => toggleResource(resource)}
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
              {/* Custom resources not in predefined list */}
              {resourcesNeeded.filter((r) => !(AVAILABLE_RESOURCES as readonly string[]).includes(r)).map((resource) => (
                <span
                  key={resource}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border bg-amber-600/30 border-amber-500 text-amber-300"
                >
                  {resource}
                  <button type="button" onClick={() => toggleResource(resource)} className="text-amber-400 hover:text-white leading-none">×</button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <input
                type="text"
                value={customResourceInput}
                onChange={(e) => setCustomResourceInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomResource(); } }}
                placeholder="Add equipment..."
                className="text-xs px-2.5 py-1 rounded-full border bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-36"
              />
              <button
                type="button"
                onClick={addCustomResource}
                className="text-xs px-2.5 py-1 rounded-full border bg-slate-700 border-slate-600 text-slate-300 hover:border-amber-500 hover:text-amber-300 transition-all"
              >
                + Add
              </button>
            </div>
          </div>
        </div>

        {/* Headcount */}
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block uppercase tracking-wider">Headcount</label>
          <input
            type="number" min={1} max={200} value={headcount}
            onChange={(e) => setHeadcount(parseInt(e.target.value) || 1)}
            className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-500 mt-1">volunteers needed</p>
          <p className="text-xs text-slate-600 mt-0.5">notifies {Math.ceil(headcount * 1.2)} (+20% buffer)</p>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-xl text-lg transition-colors flex items-center justify-center gap-3 shadow-lg shadow-red-900/30"
      >
        {submitting ? (
          <><span className="animate-spin text-xl">⟳</span> Mobilizing Volunteers...</>
        ) : (
          <>🚨 DECLARE &amp; MOBILIZE</>
        )}
      </button>

      {/* Mobilization result */}
      {mobilizeResult && (
        <div className="bg-green-900/20 border border-green-700/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-lg">✅</span>
            <div>
              <span className="text-green-300 font-semibold text-sm">
                Notified {mobilizeResult.notified} of {mobilizeResult.needed} needed
              </span>
              {mobilizeResult.overNotifiedBy > 0 && (
                <span className="ml-2 text-xs text-slate-400">(+{mobilizeResult.overNotifiedBy} over-notify buffer)</span>
              )}
              {mobilizeResult.expanded && (
                <span className="ml-2 text-xs text-amber-400">(radius expanded)</span>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-400 space-y-0.5">
            <div>Search radius: {mobilizeResult.searchRadiusKm} km</div>
            {mobilizeResult.avgDistanceKm != null && <div>Avg distance: {mobilizeResult.avgDistanceKm.toFixed(1)} km</div>}
            {mobilizeResult.nearestKm != null && (
              <div>Nearest: {mobilizeResult.nearestKm.toFixed(1)} km · Farthest: {mobilizeResult.farthestKm?.toFixed(1)} km</div>
            )}
          </div>

          {/* Coverage tables */}
          {(mobilizeResult.skillCoverage || mobilizeResult.resourceCoverage) && (
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-700/40">
              {mobilizeResult.skillCoverage && Object.keys(mobilizeResult.skillCoverage).length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider">Skills</div>
                  <div className="space-y-1">
                    {Object.entries(mobilizeResult.skillCoverage as Record<string, number>).map(([skill, count]) => (
                      <div key={skill} className="flex justify-between text-xs">
                        <span className="text-slate-400 truncate pr-2">{skill}</span>
                        <span className={count > 0 ? 'text-green-400 flex-shrink-0' : 'text-amber-400 flex-shrink-0'}>{count} {count > 0 ? '✓' : '⚠️'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {mobilizeResult.resourceCoverage && Object.keys(mobilizeResult.resourceCoverage).length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider">Equipment</div>
                  <div className="space-y-1">
                    {Object.entries(mobilizeResult.resourceCoverage as Record<string, number>).map(([resource, count]) => (
                      <div key={resource} className="flex justify-between text-xs">
                        <span className="text-slate-400 truncate pr-2">{resource}</span>
                        <span className={count > 0 ? 'text-amber-400 flex-shrink-0' : 'text-red-400 flex-shrink-0'}>{count} {count > 0 ? '✓' : '⚠️'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="text-xs text-slate-500 pt-1 border-t border-slate-700/40">
            Waiting for responses — buffer absorbs declines automatically.
          </div>
        </div>
      )}
    </form>
  );
}
