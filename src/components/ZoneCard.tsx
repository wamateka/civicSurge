'use client';

import SkillBadge from './SkillBadge';

interface ZoneNeed {
  id: string;
  zoneId: string;
  skillsNeeded: string[];
  headcount: number;
  filledCount: number;
  zone: { name: string; color: string };
}

interface ZoneCardProps {
  zoneName: string;
  zoneColor: string;
  needs: ZoneNeed[];
  volunteerCount: number;
}

export default function ZoneCard({ zoneName, zoneColor, needs, volunteerCount }: ZoneCardProps) {
  const totalNeeded = needs.reduce((s, n) => s + n.headcount, 0);
  const totalFilled = needs.reduce((s, n) => s + n.filledCount, 0);
  const pct = totalNeeded > 0 ? Math.min(100, Math.round((totalFilled / totalNeeded) * 100)) : 100;

  const barColor = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div
      className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition-colors"
      style={{ borderLeftColor: zoneColor, borderLeftWidth: 3 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white text-sm">{zoneName}</h3>
        <span className="text-xs text-slate-400">{volunteerCount} volunteers</span>
      </div>

      {needs.length === 0 ? (
        <p className="text-slate-500 text-xs">No active needs</p>
      ) : (
        <div className="space-y-3">
          {needs.map((need) => (
            <div key={need.id}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300">
                  {need.filledCount}/{need.headcount} filled
                </span>
                <span className={`font-medium ${need.filledCount >= need.headcount ? 'text-green-400' : 'text-amber-400'}`}>
                  {need.headcount - need.filledCount} needed
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-1.5 mb-2">
                <div
                  className={`${barColor} h-1.5 rounded-full transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {need.skillsNeeded.map((skill) => (
                  <SkillBadge key={skill} skill={skill} size="sm" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
