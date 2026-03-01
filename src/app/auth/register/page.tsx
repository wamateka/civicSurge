'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { AVAILABLE_SKILLS, AVAILABLE_RESOURCES } from '@/types';

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl bg-slate-800/50 border border-slate-600/50 flex items-center justify-center" style={{ height: '260px' }}>
      <span className="text-slate-500 text-sm animate-pulse">Loading map...</span>
    </div>
  ),
});

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<'VOLUNTEER' | 'ADMIN'>('VOLUNTEER');
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    skills: [] as string[],
    resources: [] as string[],
  });
  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleSkill = (skill: string) => {
    setForm((f) => ({
      ...f,
      skills: f.skills.includes(skill)
        ? f.skills.filter((s) => s !== skill)
        : [...f.skills, skill],
    }));
  };

  const toggleResource = (resource: string) => {
    setForm((f) => ({
      ...f,
      resources: f.resources.includes(resource)
        ? f.resources.filter((r) => r !== resource)
        : [...f.resources, resource],
    }));
  };

  const handleLocationChange = (lat: number, lng: number, addr?: string) => {
    setLatitude(lat);
    setLongitude(lng);
    if (addr) setAddress(addr);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.email || !form.password || !form.name) {
      setError('Email, password, and name are required');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (role === 'VOLUNTEER') {
      if (!form.phone) { setError('Phone number is required'); return; }
      if (latitude === 0 && longitude === 0) {
        setError('Please select your location on the map');
        return;
      }
      if (form.skills.length === 0) { setError('Please select at least one skill'); return; }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          name: form.name,
          role,
          ...(role === 'VOLUNTEER'
            ? {
                phone: form.phone,
                skills: form.skills,
                resources: form.resources,
                latitude,
                longitude,
                address: address || undefined,
              }
            : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Registration failed');
        return;
      }

      const signInResult = await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (signInResult?.error) {
        router.push('/auth/login');
        return;
      }

      router.push(role === 'ADMIN' ? '/dashboard/admin' : '/dashboard/volunteer');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-black text-sm">CS</span>
            </div>
            <span className="text-white font-bold text-2xl">
              Civic<span className="text-blue-400">Surge</span>
            </span>
          </Link>
          <p className="text-slate-400 mt-2 text-sm">Join the emergency response network</p>
        </div>

        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-8">
          <h1 className="text-xl font-bold text-white mb-6">Create Account</h1>

          {/* Role selector */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {(['VOLUNTEER', 'ADMIN'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`py-3 px-4 rounded-xl border text-sm font-semibold transition-all ${
                  role === r
                    ? r === 'VOLUNTEER'
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                      : 'bg-amber-600/30 border-amber-500 text-amber-300'
                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                {r === 'VOLUNTEER' ? '🙋 Volunteer' : '🛡️ Admin'}
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-sm px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Basic fields */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="Jane Smith"
                  className="w-full bg-slate-800 border border-slate-600 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  placeholder="jane@example.com"
                  className="w-full bg-slate-800 border border-slate-600 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  minLength={6}
                  placeholder="Min. 6 characters"
                  className="w-full bg-slate-800 border border-slate-600 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Volunteer-specific fields */}
            {role === 'VOLUNTEER' && (
              <div className="border-t border-slate-700/50 pt-4 space-y-4">
                <p className="text-xs text-slate-500">Volunteer Information</p>

                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+1 (555) 000-0000"
                    className="w-full bg-slate-800 border border-slate-600 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Location picker */}
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-2 block">
                    Your Location
                    <span className="text-slate-500 ml-1 normal-case font-normal">
                      (used for proximity matching)
                    </span>
                  </label>
                  <LocationPicker
                    lat={latitude}
                    lng={longitude}
                    onChange={handleLocationChange}
                  />
                </div>

                {/* Skills */}
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-2 block">
                    Your Skills <span className="text-slate-500">({form.skills.length} selected — at least one required)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_SKILLS.map((skill) => {
                      const selected = form.skills.includes(skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => toggleSkill(skill)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                            selected
                              ? 'bg-blue-600/40 border-blue-500 text-blue-300 font-medium'
                              : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
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
                  <label className="text-xs font-medium text-slate-400 mb-1 block">
                    Your Equipment <span className="text-slate-500 font-normal">(optional — check what you own and can bring)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_RESOURCES.map((resource) => {
                      const selected = form.resources.includes(resource);
                      return (
                        <button
                          key={resource}
                          type="button"
                          onClick={() => toggleResource(resource)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                            selected
                              ? 'bg-amber-600/30 border-amber-500 text-amber-300 font-medium'
                              : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
                          }`}
                        >
                          {resource}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition-colors mt-2"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-700/50 text-center">
            <p className="text-slate-400 text-sm">
              Already registered?{' '}
              <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
