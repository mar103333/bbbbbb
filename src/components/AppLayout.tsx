"use client";
import React from 'react';
import Link from 'next/link';
import { useUser } from './UserProvider';
import { Wallet, Home, History, ShieldAlert, LogOut, Ticket } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Betslip from './Betslip';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading, selections, isBetslipOpen, setIsBetslipOpen } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!loading && !profile && pathname !== '/login') {
      router.push('/login');
    }
  }, [profile, loading, pathname, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Duke ngarkuar...</div>;
  if (!profile && pathname !== '/login') return <div className="p-8 text-center text-slate-400">Duke ridrejtuar...</div>;

  return (
    <div className="flex flex-col min-h-screen bg-[#0f172a] pb-20">
      {/* Top Header */}
      <header className="glass-panel rounded-none border-t-0 border-x-0 sticky top-0 z-40 p-4 flex justify-between items-center">
        <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
          BetNow
        </h1>
        {profile && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-slate-300 text-sm font-medium mr-1">
              {profile.username}
            </div>
            <div className="flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-full border border-slate-700/50 shadow-inner">
              <Wallet size={16} className="text-emerald-400" />
              <span className="font-bold text-sm tracking-wide">
                ${Number(profile.balance).toFixed(2)}
              </span>
            </div>
            
            <button 
              onClick={() => setIsBetslipOpen(!isBetslipOpen)} 
              className={`relative p-2 rounded-full transition-colors ${selections.length > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <Ticket size={20} />
              {selections.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-white border-2 border-[#0f172a] animate-pulse">
                  {selections.length}
                </span>
              )}
            </button>

            <button onClick={handleLogout} className="text-slate-400 hover:text-rose-400 p-2 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        {children}
      </main>

      {/* Global Betslip Modal */}
      <Betslip />

      {/* Bottom Navigation */}
      {profile && (
        <nav className="glass-panel rounded-none border-b-0 border-x-0 fixed bottom-0 w-full z-40 px-6 py-3 flex justify-around max-w-2xl mx-auto left-0 right-0">
          <Link href="/" className={`flex flex-col items-center gap-1 transition-colors ${pathname === '/' ? 'text-emerald-400' : 'text-slate-400 hover:text-emerald-400'}`}>
            <Home size={22} />
            <span className="text-[11px] font-semibold">Ndeshjet</span>
          </Link>
          <Link href="/history" className={`flex flex-col items-center gap-1 transition-colors ${pathname === '/history' ? 'text-emerald-400' : 'text-slate-400 hover:text-emerald-400'}`}>
            <History size={22} />
            <span className="text-[11px] font-semibold">Basteve</span>
          </Link>
          {profile.role === 'admin' && (
            <Link href="/admin" className={`flex flex-col items-center gap-1 transition-colors ${pathname === '/admin' ? 'text-rose-400' : 'text-slate-400 hover:text-rose-400'}`}>
              <ShieldAlert size={22} />
              <span className="text-[11px] font-semibold">Admin</span>
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
