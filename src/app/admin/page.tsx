"use client";
import React, { useEffect, useState } from 'react';
import { useUser } from '@/components/UserProvider';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

export default function AdminPanel() {
  const { profile, loading } = useUser();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [credits, setCredits] = useState<Record<string, string>>({});
  const [pendingBets, setPendingBets] = useState<any[]>([]);
  const [processingBet, setProcessingBet] = useState<string | null>(null);
  const [isAutoSettling, setIsAutoSettling] = useState(false);

  // New Account Creation States
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  useEffect(() => {
    if (!loading) {
      if (!profile || profile.role !== 'admin') {
        router.push('/');
      } else {
        fetchUsers();
        fetchPendingBets();
      }
    }
  }, [profile, loading, router]);

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data);
  };

  const fetchPendingBets = async () => {
    const { data } = await supabase
      .from('bets')
      .select('*, profiles(username)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (data) setPendingBets(data);
  };

  const handleAddCredit = async (userId: string, currentBalance: number) => {
    const amount = parseFloat(credits[userId] || '0');
    if (amount <= 0 || isNaN(amount)) return;

    const newBalance = currentBalance + amount;
    const { error } = await supabase.from('profiles').update({ balance: newBalance }).eq('id', userId);
    
    if (!error) {
      setCredits(prev => ({ ...prev, [userId]: '' }));
      fetchUsers();
    } else {
      alert("Gabim gjatë shtimit të kredisë.");
    }
  };

  const handleSettleBet = async (bet: any, status: 'won' | 'lost') => {
    setProcessingBet(bet.id);
    try {
      // First update bet status
      const { error: betError } = await supabase
        .from('bets')
        .update({ status })
        .eq('id', bet.id);

      if (betError) throw betError;

      // If won, credit the user
      if (status === 'won') {
        // Fetch current user balance to ensure we have the latest
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', bet.user_id)
          .single();
          
        if (userError) throw userError;

        const newBalance = userData.balance + bet.potential_payout;

        const { error: balanceError } = await supabase
          .from('profiles')
          .update({ balance: newBalance })
          .eq('id', bet.user_id);

        if (balanceError) throw balanceError;
      }
      
      // Refresh data
      fetchPendingBets();
      fetchUsers(); // Update balances if won
    } catch (error) {
      console.error(error);
      alert("Ndodhi një gabim gjatë procesimit të bastit.");
    }
    setProcessingBet(null);
  };

  const handleAutoSettle = async () => {
    setIsAutoSettling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/admin/settle', { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to auto-settle');
      
      alert(`Auto-settlement complete. Settled ${data.settled} bets.`);
      fetchPendingBets();
      fetchUsers();
    } catch (error: any) {
      console.error(error);
      alert("Gabim gjatë auto-settlement: " + error.message);
    }
    setIsAutoSettling(false);
  };

  const handleForceSettle = async () => {
    setIsAutoSettling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/admin/settle?force=1', { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to force-settle');
      
      alert(`Forced re-evaluation complete. Checked and fixed ${data.settled} bets.`);
      fetchPendingBets();
      fetchUsers();
    } catch (error: any) {
      console.error(error);
      alert("Gabim gjatë force-settlement: " + error.message);
    }
    setIsAutoSettling(false);
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newEmail || !newPassword) {
      setCreateError("Të gjitha fushat janë të detyrueshme.");
      return;
    }
    setCreateLoading(true);
    setCreateError('');
    setCreateSuccess('');

    try {
      const tempSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          }
        }
      );

      const { data, error: signUpError } = await tempSupabase.auth.signUp({
        email: newEmail,
        password: newPassword,
      });

      if (signUpError) {
        setCreateError(signUpError.message);
        setCreateLoading(false);
        return;
      }

      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').insert([
          {
            id: data.user.id,
            username: newUsername,
            role: 'student',
            balance: 1000.00
          }
        ]);

        if (profileError) {
          setCreateError(profileError.message);
        } else {
          setCreateSuccess(`Llogaria e studentit "${newUsername}" u krijua me sukses me balancë $1,000.00!`);
          setNewUsername('');
          setNewEmail('');
          setNewPassword('');
          fetchUsers();
        }
      }
    } catch (err: any) {
      setCreateError(err.message || "Ndodhi një gabim.");
    }
    setCreateLoading(false);
  };

  const renderSelection = (selection: string, market: string) => {
    if (market === 'parlay') {
      try {
        const parsed = JSON.parse(selection);
        return (
          <div className="space-y-1 mt-1">
            {parsed.map((s: any, i: number) => (
              <div key={i} className="text-[10px] bg-slate-800/50 p-1.5 rounded">
                <span className="text-emerald-400 font-bold block">{s.matchName}</span>
                <span className="text-slate-300">{s.outcomeName} ({s.odd.toFixed(2)})</span>
              </div>
            ))}
          </div>
        );
      } catch {
        return selection;
      }
    }
    return selection;
  };

  if (loading || !profile || profile.role !== 'admin') return <div className="text-center p-8">Duke ngarkuar...</div>;

  return (
    <div className="space-y-8 animate-slide-up pb-12">
      <div>
        <h2 className="text-2xl font-black text-white mb-1">Paneli i Adminit</h2>
        <p className="text-slate-400 text-sm">Menaxhoni përdoruesit, llogaritë dhe vlerësimin e basteve.</p>
      </div>

      {/* Bets Management Panel */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">Baste në Pritje ({pendingBets.length})</h3>
          <div className="flex gap-2">
            <button 
              onClick={handleForceSettle}
              disabled={isAutoSettling}
              className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-rose-900/20"
            >
              {isAutoSettling ? 'Duke procesuar...' : 'Fix All Bets (Force)'}
            </button>
            <button 
              onClick={handleAutoSettle}
              disabled={isAutoSettling || pendingBets.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-emerald-900/20"
            >
              {isAutoSettling ? 'Duke procesuar...' : 'Auto-Settle Finished Matches'}
            </button>
          </div>
        </div>
        {pendingBets.length === 0 ? (
          <div className="glass-panel p-6 text-center text-slate-400 text-sm border-t-emerald-500/30 border-t-4">
            Nuk ka asnjë bast në pritje.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pendingBets.map(bet => (
              <div key={bet.id} className="glass-panel p-5 border-l-4 border-l-blue-500 relative">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-xs text-blue-400 font-bold uppercase tracking-wider block mb-1">
                      {bet.profiles?.username || 'Përdoruesi'}
                    </span>
                    <h4 className="text-sm font-bold text-white">{bet.match_name}</h4>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs text-slate-400">Data</span>
                    <span className="text-xs text-slate-300">
                      {new Date(bet.created_at).toLocaleString([], {dateStyle: 'short', timeStyle: 'short'})}
                    </span>
                  </div>
                </div>

                <div className="mb-4 text-sm text-slate-300">
                  <span className="font-medium text-slate-400 block mb-1">Zgjedhja ({bet.market}):</span>
                  {renderSelection(bet.selection, bet.market)}
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-900/50 p-3 rounded-lg mb-4 text-center">
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase">Koef.</span>
                    <span className="font-bold text-white">{Number(bet.odd).toFixed(2)}</span>
                  </div>
                  <div className="border-x border-slate-700/50">
                    <span className="block text-[10px] text-slate-400 uppercase">Shuma</span>
                    <span className="font-bold text-white">${Number(bet.stake).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-emerald-500 uppercase">Fitimi</span>
                    <span className="font-bold text-emerald-400">${Number(bet.potential_payout).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => handleSettleBet(bet, 'won')}
                    disabled={processingBet === bet.id}
                    className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/50 py-2 rounded font-bold text-sm transition-colors disabled:opacity-50"
                  >
                    Fitoi
                  </button>
                  <button 
                    onClick={() => handleSettleBet(bet, 'lost')}
                    disabled={processingBet === bet.id}
                    className="flex-1 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 border border-rose-500/50 py-2 rounded font-bold text-sm transition-colors disabled:opacity-50"
                  >
                    Humbi
                  </button>
                </div>
                {processingBet === bet.id && (
                  <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center rounded-xl z-10">
                    <span className="text-emerald-400 text-sm font-bold animate-pulse">Duke procesuar...</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create New Account Configuration Panel */}
      <div className="glass-panel p-6 border-t-emerald-500/30 border-t-4">
        <h3 className="text-lg font-bold text-white mb-4">Krijo Llogari të Re</h3>
        
        {createError && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-lg mb-4 text-xs">
            {createError}
          </div>
        )}
        {createSuccess && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-lg mb-4 text-xs font-semibold">
            {createSuccess}
          </div>
        )}

        <form onSubmit={handleCreateStudent} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Emri i Përdoruesit</label>
            <input 
              type="text" 
              placeholder="p.sh. filanfisteku" 
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-emerald-500"
              value={newUsername} 
              onChange={(e) => setNewUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Email</label>
            <input 
              type="email" 
              placeholder="p.sh. filan@betnow.com" 
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-emerald-500"
              value={newEmail} 
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Fjalëkalimi</label>
            <input 
              type="password" 
              placeholder="******" 
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-emerald-500"
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="md:col-span-3 mt-2 flex justify-end">
            <button 
              type="submit" 
              disabled={createLoading}
              className="btn-primary w-full md:w-auto px-6 py-2.5 text-sm"
            >
              {createLoading ? 'Duke regjistruar...' : 'Krijo Student'}
            </button>
          </div>
        </form>
      </div>

      {/* Users List & Credits Injection Panel */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white">Lista e Përdoruesve</h3>
        <div className="glass-panel p-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="p-3 text-sm text-slate-400">Përdoruesi</th>
                <th className="p-3 text-sm text-slate-400">Balanca Aktuale</th>
                <th className="p-3 text-sm text-slate-400">Shto Kredi</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-slate-800/50">
                  <td className="p-3 text-white font-medium">
                    {u.username || 'N/A'} 
                    <span className="text-xs text-slate-500 ml-2">({u.role})</span>
                  </td>
                  <td className="p-3 text-emerald-400 font-bold">${Number(u.balance).toFixed(2)}</td>
                  <td className="p-3">
                    <div className="flex gap-2 max-w-[200px]">
                      <input 
                        type="number"
                        placeholder="0.00"
                        className="w-24 p-2 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-emerald-500"
                        value={credits[u.id] || ''}
                        onChange={(e) => setCredits({ ...credits, [u.id]: e.target.value })}
                      />
                      <button 
                        onClick={() => handleAddCredit(u.id, Number(u.balance))}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-sm font-semibold transition-colors"
                      >
                        Shto
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
