'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';

export default function Navbar() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-slate-900 border-b border-slate-700/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">CS</span>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">
              Civic<span className="text-blue-400">Surge</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/map" className="text-slate-400 hover:text-white transition-colors text-sm">
              Live Map
            </Link>
            {session ? (
              <>
                <Link
                  href={session.user.role === 'ADMIN' ? '/dashboard/admin' : '/dashboard/volunteer'}
                  className="text-slate-400 hover:text-white transition-colors text-sm"
                >
                  Dashboard
                </Link>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        session.user.role === 'ADMIN' ? 'bg-amber-400' : 'bg-green-400'
                      }`}
                    />
                    <span className="text-slate-300 text-sm">{session.user.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        session.user.role === 'ADMIN'
                          ? 'bg-amber-900/40 text-amber-300 border border-amber-700/50'
                          : 'bg-green-900/40 text-green-300 border border-green-700/50'
                      }`}
                    >
                      {session.user.role}
                    </span>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="text-slate-400 hover:text-red-400 transition-colors text-sm"
                  >
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/auth/login"
                  className="text-slate-400 hover:text-white transition-colors text-sm"
                >
                  Login
                </Link>
                <Link
                  href="/auth/register"
                  className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-slate-400 hover:text-white"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-slate-700/50 py-3 space-y-2">
            <Link href="/map" className="block text-slate-400 hover:text-white px-2 py-1 text-sm">
              Live Map
            </Link>
            {session ? (
              <>
                <Link
                  href={session.user.role === 'ADMIN' ? '/dashboard/admin' : '/dashboard/volunteer'}
                  className="block text-slate-400 hover:text-white px-2 py-1 text-sm"
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="block text-red-400 hover:text-red-300 px-2 py-1 text-sm"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="block text-slate-400 hover:text-white px-2 py-1 text-sm">
                  Login
                </Link>
                <Link href="/auth/register" className="block text-blue-400 hover:text-blue-300 px-2 py-1 text-sm">
                  Register
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
