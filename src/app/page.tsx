'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import { getSocket } from '@/lib/socket';

const LiveMap = dynamic(() => import('@/components/LiveMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-800/50 rounded-xl animate-pulse flex items-center justify-center">
      <span className="text-slate-500 text-sm">Loading map...</span>
    </div>
  ),
});

export default function LandingPage() {
  const [stats, setStats] = useState({ totalVolunteers: 0, activeEvents: 0 });
  const [liveActivity, setLiveActivity] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});

    const socket = getSocket();

    const handleSurge = (data: any) => {
      const evt = data.surgeEvent;
      setLiveActivity((prev) =>
        [`🚨 New ${evt.type} event: ${evt.title}`, ...prev].slice(0, 5)
      );
      setStats((s) => ({ ...s, activeEvents: s.activeEvents + 1 }));
    };

    const handleMobilized = (data: any) => {
      setLiveActivity((prev) =>
        [`✅ ${data.deployments?.length ?? 0} volunteers mobilized`, ...prev].slice(0, 5)
      );
    };

    socket.on('surge:created', handleSurge);
    socket.on('surge:mobilized', handleMobilized);
    socket.on('surge:auto-triggered', (data: any) => {
      setLiveActivity((prev) =>
        [`📡 IoT Triggered: ${data.sensorType} threshold exceeded`, ...prev].slice(0, 5)
      );
    });

    return () => {
      socket.off('surge:created', handleSurge);
      socket.off('surge:mobilized', handleMobilized);
      socket.off('surge:auto-triggered');
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-30" />
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-600/10 blur-3xl rounded-full" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
          <div className="text-center mb-16">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-blue-900/30 border border-blue-700/50 text-blue-400 text-sm px-4 py-1.5 rounded-full mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              Smart City Emergency Platform
            </div>

            <h1 className="text-5xl sm:text-7xl font-black tracking-tight text-white mb-6">
              When disaster strikes,
              <br />
              <span className="text-blue-400">mobilize</span> in{' '}
              <span className="text-amber-400">seconds</span>.
            </h1>

            <p className="text-slate-400 text-xl max-w-3xl mx-auto mb-10 leading-relaxed">
              CivicSurge connects pre-registered volunteers to emergencies using intelligent matching,
              IoT sensor triggers, and real-time coordination. No calls, no delays — just instant action.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth/register"
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-xl text-lg transition-all transform hover:scale-105 shadow-lg shadow-blue-900/40"
              >
                Register as Volunteer
              </Link>
              <Link
                href="/auth/login"
                className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold px-8 py-4 rounded-xl text-lg transition-all"
              >
                Admin Login →
              </Link>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mb-16">
            {[
              { value: stats.totalVolunteers, label: 'Registered Volunteers', color: 'text-blue-400', icon: '👥' },
              { value: stats.activeEvents, label: 'Active Emergencies', color: 'text-red-400', icon: '🚨' },
              { value: '< 30s', label: 'Avg. Mobilization Time', color: 'text-green-400', icon: '⚡' },
              { value: 'Dynamic', label: 'Radius Targeting', color: 'text-amber-400', icon: '🗺️' },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 text-center"
              >
                <div className="text-2xl mb-1">{stat.icon}</div>
                <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live map preview + activity feed */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="text-green-400 text-sm font-medium">LIVE</span>
              </div>
              <h2 className="text-white font-semibold">City Coverage Map</h2>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-700/50 h-[400px]">
              <LiveMap height="400px" showVolunteers={false} />
            </div>
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {/* Live activity */}
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                Live Activity
              </h3>
              {liveActivity.length === 0 ? (
                <p className="text-slate-500 text-sm">Monitoring for events...</p>
              ) : (
                <ul className="space-y-2">
                  {liveActivity.map((item, i) => (
                    <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                      <span className="text-xs text-slate-500 mt-0.5 shrink-0">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* How it works */}
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
              <h3 className="font-semibold text-white mb-3">How It Works</h3>
              <ol className="space-y-3">
                {[
                  { step: '1', text: 'Volunteers register with skills & location', icon: '👤' },
                  { step: '2', text: 'IoT sensors detect anomalies or admin declares event', icon: '📡' },
                  { step: '3', text: 'AI matching engine selects best-fit volunteers', icon: '🤖' },
                  { step: '4', text: 'SMS + app alerts sent. Volunteers respond in-app', icon: '📱' },
                  { step: '5', text: 'Live map shows real-time deployment coverage', icon: '🗺️' },
                ].map((item) => (
                  <li key={item.step} className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0">{item.icon}</span>
                    <span className="text-sm text-slate-400">{item.text}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Features section */}
      <section className="bg-slate-900/50 border-y border-slate-800 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-white text-center mb-12">
            Built for the <span className="text-blue-400">Real World</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: '📡',
                title: 'IoT Auto-Trigger',
                desc: 'Water sensors, wind monitors, and temperature probes automatically trigger mobilization before officials even declare an emergency.',
                color: 'blue',
              },
              {
                icon: '🤖',
                title: 'Smart Matching',
                desc: 'Our algorithm scores volunteers by proximity to the epicenter, skill match, and availability — mobilizing the closest qualified responders first.',
                color: 'purple',
              },
              {
                icon: '⚡',
                title: 'Real-Time Coordination',
                desc: 'Socket.io powers live map updates, instant notifications, and a live feed of volunteer responses across the command center.',
                color: 'amber',
              },
            ].map((f) => (
              <div
                key={f.title}
                className={`bg-${f.color}-900/20 border border-${f.color}-700/30 rounded-xl p-6`}
              >
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="text-xl font-bold text-white mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-slate-500 text-sm">
        <p>CivicSurge — Built for PickHacks 2026 · Smart Cities Theme</p>
      </footer>
    </div>
  );
}
