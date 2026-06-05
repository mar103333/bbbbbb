"use client";
import React, { useEffect, useState } from 'react';
import { useUser } from '@/components/UserProvider';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function HistoryPage() {
  const { profile, loading, refreshProfile } = useUser();
  const router = useRouter();
  const [bets, setBets] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !profile) {
      router.push('/login');
    } else if (profile) {
      fetchBets();
    }
  }, [profile, loading, router]);

  const fetchBets = async () => {
    setFetching(true);
    const { data } = await supabase
      .from('bets')
      .select('*')
      .eq('user_id', profile?.id)
      .order('created_at', { ascending: false });
      
    if (data) setBets(data);
    setFetching(false);
  };

  // Simulation Logic: Randomly resolve a pending bet every 10 seconds
  useEffect(() => {
    if (!profile) return;
    const interval = setInterval(async () => {
      const pendingBets = bets.filter(b => b.status === 'pending');
      if (pendingBets.length > 0) {
        // Pick random pending bet
        const randomBet = pendingBets[Math.floor(Math.random() * pendingBets.length)];
        // 50/50 chance to win or lose
        const isWon = Math.random() > 0.5;
        const newStatus = isWon ? 'won' : 'lost';

        // Update bet status
        await supabase.from('bets').update({ status: newStatus }).eq('id', randomBet.id);
        
        // If won, add payout to balance
        if (isWon) {
          const { data: currentProfile } = await supabase.from('profiles').select('balance').eq('id', profile.id).single();
          if (currentProfile) {
            await supabase.from('profiles').update({ balance: currentProfile.balance + randomBet.potential_payout }).eq('id', profile.id);
            refreshProfile();
          }
        }
        
        // Refresh local list
        fetchBets();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [bets, profile, refreshProfile]);

  const formatSelection = (selectionText: string, matchName: string, market: string, odd: string) => {
    let outcome = selectionText;
    let home = '', away = '';
    
    try {
      const parts = matchName.split(' | ');
      if (parts.length > 1) {
        const teams = parts[1].split(' vs ');
        home = teams[0];
        away = teams[1];
      }
    } catch (e) {}

    if (home && outcome === home) outcome = 'Home Victory';
    else if (away && outcome === away) outcome = 'Away Victory';
    else if (outcome === 'Draw') outcome = 'Match Draw';
    
    outcome = String(outcome).replace(/_/g, ' ').replace(/[\[\]]/g, '');
    
    return `${matchName} | ${market}: ${outcome} | Odds: ${Number(odd).toFixed(2)}`;
  };

  const renderSelection = (selection: string, market: string, matchName?: string, odd?: string) => {
    if (market === 'parlay') {
      try {
        const parsed = JSON.parse(selection);
        return (
          <div className="space-y-2 mt-2 mb-2">
            {parsed.map((s: any, i: number) => (
              <div key={i} className="text-xs bg-slate-800/60 p-2 rounded border border-slate-700/50">
                <span className="text-emerald-400 font-bold block mb-1">{s.matchName}</span>
                <span className="text-slate-300">{formatSelection(s.outcomeName, s.matchName, s.market, s.odd)}</span>
              </div>
            ))}
          </div>
        );
      } catch {
        return <span className="text-white font-semibold">{selection}</span>;
      }
    }
    return <span className="text-white font-semibold">{matchName ? formatSelection(selection, matchName, market, odd || '0') : selection}</span>;
  };

  if (loading || fetching) return <div className="text-center p-8 text-slate-400">Duke ngarkuar...</div>;

  const activeBets = bets.filter(b => b.status === 'pending');
  const settledBets = bets.filter(b => b.status !== 'pending');

  return (
    <div className="space-y-8 animate-slide-up pb-8">
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Baste Aktive
        </h2>
        {activeBets.length === 0 ? (
          <p className="text-slate-400 text-sm glass-panel p-4">Nuk keni asnjë bast aktiv.</p>
        ) : (
          <div className="space-y-3">
            {activeBets.map(bet => (
              <div key={bet.id} className="glass-panel p-4 border-l-4 border-l-emerald-400">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-white font-bold text-sm">{bet.match_name}</h4>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded font-bold">Në Pritje</span>
                </div>
                <div className="text-slate-400 text-xs mb-3">Zgjedhja: {renderSelection(bet.selection, bet.market, bet.match_name, bet.odd)}
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Shuma: <span className="text-white font-semibold">${Number(bet.stake).toFixed(2)}</span></span>
                  <span className="text-emerald-400 font-bold">Fitimi: ${Number(bet.potential_payout).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold text-white mb-4">Historiku i Basteve</h2>
        {settledBets.length === 0 ? (
          <p className="text-slate-400 text-sm glass-panel p-4">Nuk keni asnjë bast të përfunduar.</p>
        ) : (
          <div className="space-y-3">
            {settledBets.map(bet => (
              <div key={bet.id} className={`glass-panel p-4 border-l-4 ${bet.status === 'won' ? 'border-l-emerald-500 bg-emerald-900/10' : 'border-l-rose-500 bg-rose-900/10'}`}>
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-white font-bold text-sm">{bet.match_name}</h4>
                  <span className={`text-[10px] px-2 py-1 rounded font-bold ${bet.status === 'won' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {bet.status === 'won' ? 'Fitues' : 'Humbur'}
                  </span>
                </div>
                <div className="text-slate-400 text-xs mb-3">Zgjedhja: {renderSelection(bet.selection, bet.market, bet.match_name, bet.odd)}
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Shuma: <span className="text-white font-semibold">${Number(bet.stake).toFixed(2)}</span></span>
                  <span className={`${bet.status === 'won' ? 'text-emerald-400' : 'text-slate-500'} font-bold`}>
                    Fitimi: ${Number(bet.potential_payout).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
