'use client';

interface SkillBadgeProps {
  skill: string;
  size?: 'sm' | 'md';
  highlighted?: boolean;
}

const SKILL_COLORS: Record<string, string> = {
  'First Aid': 'bg-red-900/40 text-red-300 border-red-700/50',
  Medical: 'bg-red-900/40 text-red-300 border-red-700/50',
  'Search & Rescue': 'bg-orange-900/40 text-orange-300 border-orange-700/50',
  'Fire Safety': 'bg-orange-900/40 text-orange-300 border-orange-700/50',
  'Flood Control': 'bg-blue-900/40 text-blue-300 border-blue-700/50',
  'Heavy Lifting': 'bg-slate-700/60 text-slate-300 border-slate-600/50',
  Driving: 'bg-purple-900/40 text-purple-300 border-purple-700/50',
  Communication: 'bg-green-900/40 text-green-300 border-green-700/50',
  'General Labor': 'bg-slate-700/60 text-slate-300 border-slate-600/50',
  Construction: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50',
  Cooking: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  'Mental Health Support': 'bg-pink-900/40 text-pink-300 border-pink-700/50',
  Translation: 'bg-cyan-900/40 text-cyan-300 border-cyan-700/50',
  Logistics: 'bg-indigo-900/40 text-indigo-300 border-indigo-700/50',
  'IT Support': 'bg-violet-900/40 text-violet-300 border-violet-700/50',
  'CERT Trained': 'bg-amber-900/40 text-amber-300 border-amber-700/50',
};

export default function SkillBadge({ skill, size = 'md', highlighted = false }: SkillBadgeProps) {
  const colorClass = SKILL_COLORS[skill] ?? 'bg-slate-700/60 text-slate-300 border-slate-600/50';
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2.5 py-1';
  const highlightClass = highlighted ? 'ring-1 ring-blue-400 scale-105' : '';

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium transition-transform ${colorClass} ${sizeClass} ${highlightClass}`}
    >
      {skill}
    </span>
  );
}
