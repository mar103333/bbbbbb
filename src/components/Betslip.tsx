"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useUser } from './UserProvider';
import { supabase } from '@/lib/supabase';
import { X, CheckCircle2, Trash2, AlertTriangle } from 'lucide-react';

type BetMode = 'single' | 'parlay';

export default function Betslip() {
  const { profile, refreshProfile, selections, removeSelection, clearSelections, isBetslipOpen, setIsBetslipOpen } = useUser();
  const [mode, setMode] = useState<BetMode>('single');
  const [stakes, setStakes] = useState<Record<string, string>>({});
  const [parlayStake, setParlayStake] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Validate Parlay
  const hasSameGameParlay = useMemo(() => {
    const matchIds = selections.map(s => s.matchId);
    return new Set(matchIds).size !== matchIds.length;
  }, [selections]);

  const parlayOdds = useMemo(() => {
    return selections.reduce((acc, sel) => acc * sel.odd, 1);
  }, [selections]);

  useEffect(() => {
    setSuccess(false);
    setError('');
  }, [selections, mode]);

  if (!isBetslipOpen) return null;

  const handleClose = () => {
    setIsBetslipOpen(false);
  };

  if (selections.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-slide-up">
        <div className="glass-panel w-full max-w-md p-6 relative border-t-emerald-500/30 border-t-4 text-center">
          <button onClick={handleClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
          <h3 className="text-lg font-bold text-white mb-2">Skeda Jote</h3>
          <p className="text-slate-400 text-sm mb-4">Nuk keni zgjedhur asnjë bast ende.</p>
        </div>
      </div>
    );
  }

  const getStakeKey = (matchId: string, market: string) => `${matchId}-${market}`;

  const handleStakeChange = (matchId: string, market: string, val: string) => {
    setStakes(prev => ({
      ...prev,
      [getStakeKey(matchId, market)]: val
    }));
  };

  const getPotentialPayout = (odd: number, stakeVal: string) => {
    const numericStake = parseFloat(stakeVal || '0');
    return (numericStake * odd).toFixed(2);
  };

  // Calculate totals
  let totalStake = 0;
  let totalPotentialPayout = 0;

  if (mode === 'single') {
    totalStake = selections.reduce((acc, sel) => {
      const stakeVal = stakes[getStakeKey(sel.matchId, sel.market)] || '';
      return acc + parseFloat(stakeVal || '0');
    }, 0);
    totalPotentialPayout = selections.reduce((acc, sel) => {
      const stakeVal = stakes[getStakeKey(sel.matchId, sel.market)] || '';
      return acc + parseFloat(getPotentialPayout(sel.odd, stakeVal));
    }, 0);
  } else {
    totalStake = parseFloat(parlayStake || '0');
    totalPotentialPayout = parseFloat(getPotentialPayout(parlayOdds, parlayStake));
  }

  const handlePlaceBets = async () => {
    if (!profile) return;
    
    let hasInvalidStakes = false;
    const betsToInsert: any[] = [];

    if (mode === 'single') {
      for (const sel of selections) {
        const key = getStakeKey(sel.matchId, sel.market);
        const stakeVal = stakes[key];
        const numericStake = parseFloat(stakeVal || '0');
        
        if (isNaN(numericStake) || numericStake <= 0) {
          hasInvalidStakes = true;
          break;
        }

        betsToInsert.push({
          user_id: profile.id,
          match_id: sel.matchId,
          match_name: sel.matchName,
          market: sel.market,
          selection: sel.outcomeName,
          odd: sel.odd,
          stake: numericStake,
          potential_payout: parseFloat(getPotentialPayout(sel.odd, stakeVal)),
          status: 'pending'
        });
      }
    } else {
      // Parlay
      if (hasSameGameParlay) return; // Prevent placing

      const numericStake = parseFloat(parlayStake || '0');
      if (isNaN(numericStake) || numericStake <= 0) {
        hasInvalidStakes = true;
      } else {
        betsToInsert.push({
          user_id: profile.id,
          match_id: `parlay_${Date.now()}`,
          match_name: `Skedina (${selections.length} Ndeshje)`,
          market: 'parlay',
          selection: JSON.stringify(selections),
          odd: parlayOdds,
          stake: numericStake,
          potential_payout: totalPotentialPayout,
          status: 'pending'
        });
      }
    }

    if (hasInvalidStakes) {
      setError("Ju lutem shkruani një shumë të vlefshme për të gjitha përzgjedhjet.");
      return;
    }

    if (totalStake > profile.balance) {
      setError("Nuk keni balancë të mjaftueshme për të mbuluar të gjitha bastet.");
      return;
    }

    setLoading(true);
    setError('');

    const newBalance = profile.balance - totalStake;
    
    const { error: balanceError } = await supabase
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', profile.id);

    if (balanceError) {
      setError("Gabim gjatë zbritjes së balancës.");
      setLoading(false);
      return;
    }

    const { error: betError } = await supabase
      .from('bets')
      .insert(betsToInsert);

    if (betError) {
      // Revert balance on error
      await supabase.from('profiles').update({ balance: profile.balance }).eq('id', profile.id);
      setError("Gabim gjatë vendosjes së basteve.");
      setLoading(false);
      return;
    }

    await refreshProfile();
    setSuccess(true);
    setLoading(false);
    
    setTimeout(() => {
      setSuccess(false);
      clearSelections();
      setIsBetslipOpen(false);
      setStakes({});
      setParlayStake('');
    }, 2000);
  };

  const isParlayDisabled = mode === 'parlay' && hasSameGameParlay;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-slide-up">
      <div className="glass-panel w-full max-w-md p-6 relative border-t-emerald-500/30 border-t-4 max-h-[90vh] flex flex-col">
        {!success ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">Skeda Jote</h3>
              <div className="flex items-center gap-4">
                <button 
                  onClick={clearSelections} 
                  className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
                  title="Pastro të gjitha"
                >
                  <Trash2 size={14} />
                  Pastro
                </button>
                <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Mode Toggle */}
            {selections.length > 1 && (
              <div className="flex gap-2 bg-slate-900 p-1 rounded-lg mb-4">
                <button 
                  onClick={() => setMode('single')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${mode === 'single' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Teke
                </button>
                <button 
                  onClick={() => setMode('parlay')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${mode === 'parlay' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Skedina ({selections.length})
                </button>
              </div>
            )}

            {mode === 'parlay' && hasSameGameParlay && (
              <div className="bg-orange-900/30 border border-orange-700/50 rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertTriangle className="text-orange-400 shrink-0 mt-0.5" size={16} />
                <p className="text-[11px] text-orange-200 leading-snug">
                  <strong>Kujdes:</strong> Në skedinë nuk lejohen dy përzgjedhje nga e njëjta ndeshje. Hiqni përzgjedhjet e dyfishta për të vazhduar.
                </p>
              </div>
            )}

            {/* List of selections */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 mb-4 max-h-[45vh]">
              {selections.map((sel) => {
                const key = getStakeKey(sel.matchId, sel.market);
                const stakeVal = stakes[key] || '';
                const payoutVal = getPotentialPayout(sel.odd, stakeVal);
                
                const formatSelection = (selection: any) => {
                  let outcome = selection.outcomeName;
                  let home = '', away = '';
                  let matchTitle = selection.matchName;
                  
                  try {
                    const parts = selection.matchName.split(' | ');
                    if (parts.length > 1) {
                      matchTitle = parts[1].trim();
                      const teams = matchTitle.split(' vs ');
                      home = teams[0].trim();
                      away = teams[1].trim();
                    }
                  } catch (e) {}

                  // Clean up outcome string
                  outcome = String(outcome).replace(/_/g, ' ').replace(/[\[\]]/g, '');

                  const translateOutcome = (str: string) => {
                    return str.replace(/\bYes\b/gi, 'Po')
                              .replace(/\bNo\b/gi, 'Jo')
                              .replace(/\bDraw\b/gi, 'Barazim');
                  };

                  // Determine victory mapping
                  let displayOutcome = outcome;
                  if (home && outcome === home) displayOutcome = 'Home Victory';
                  else if (away && outcome === away) displayOutcome = 'Away Victory';
                  else if (outcome === 'Draw') displayOutcome = 'Match Draw';
                  
                  displayOutcome = translateOutcome(displayOutcome);
                  const cleanOutcome = translateOutcome(outcome);
                  
                  let marketDisplay = '';
                  if (selection.market === 'Both Teams Score') {
                    marketDisplay = `Both Teams Score (${cleanOutcome})`;
                  } else if (selection.market === 'Goals Over/Under') {
                    marketDisplay = `${cleanOutcome} Goals`;
                  } else if (selection.market === 'Spreads') {
                    marketDisplay = `Spreads (Handicap): ${cleanOutcome}`;
                  } else if (selection.market === 'Corners Over/Under') {
                    marketDisplay = `${cleanOutcome} Corners`;
                  } else if (selection.market === 'Match Winner') {
                    marketDisplay = `Match Winner (${displayOutcome})`;
                  } else if (selection.market === 'Draw No Bet') {
                    marketDisplay = `Draw No Bet (${displayOutcome})`;
                  } else if (selection.market === 'Correct Score') {
                    marketDisplay = `Rezultati i Saktë: ${cleanOutcome}`;
                  } else if (selection.market === '1st Half Totals') {
                    marketDisplay = `Pjesa e Parë - Gola: ${cleanOutcome}`;
                  } else if (selection.market === '1st Half Result') {
                    marketDisplay = `Pjesa e Parë - Fituesi (${displayOutcome})`;
                  } else if (selection.market === 'BTTS Both Halves') {
                    marketDisplay = `BTTS në të dyja Pjesët: ${cleanOutcome}`;
                  } else if (selection.market === 'First Team to Score') {
                    marketDisplay = `Skuadra që Shënon e Para: ${cleanOutcome}`;
                  } else if (selection.market === '1X2 & BTTS Combo') {
                    marketDisplay = `1X2 & BTTS: ${cleanOutcome}`;
                  } else {
                    marketDisplay = `${selection.market}: ${cleanOutcome}`;
                  }
                  
                  return `${matchTitle} | ${marketDisplay} | Odds: ${selection.odd.toFixed(2)}`;
                };

                return (
                  <div key={key} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 relative">
                    <button 
                      onClick={() => removeSelection(sel.matchId, sel.market)} 
                      className="absolute top-2.5 right-2.5 text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <X size={16} />
                    </button>

                    
                    <div className="flex items-center justify-between mb-3 bg-slate-800/40 p-2 rounded-lg border border-slate-800">
                      <span className="text-xs text-emerald-400 font-medium">
                        {formatSelection(sel)}
                      </span>
                    </div>

                    {mode === 'single' && (
                      <div className="grid grid-cols-2 gap-3 items-center">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Shuma</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">$</span>
                            <input 
                              type="number"
                              placeholder="0.00"
                              className="w-full pl-6 pr-2 py-1.5 bg-slate-950/80 border border-slate-800 rounded-md text-white text-xs font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                              value={stakeVal}
                              onChange={(e) => handleStakeChange(sel.matchId, sel.market, e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Fitimi i Mundshëm</span>
                          <span className="text-sm font-black text-emerald-400">${payoutVal}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Parlay Global Stake */}
            {mode === 'parlay' && !hasSameGameParlay && selections.length > 1 && (
              <div className="bg-slate-900/80 border border-emerald-500/30 rounded-xl p-4 mb-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-300 uppercase">Koeficienti Total:</span>
                  <span className="text-lg font-black text-emerald-400">{parlayOdds.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Shuma Skedinë</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                      <input 
                        type="number"
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white text-sm font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                        value={parlayStake}
                        onChange={(e) => setParlayStake(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Fitimi Potencial</span>
                    <span className="text-lg font-black text-emerald-400">${totalPotentialPayout.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Totals Summary */}
            <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl space-y-2 mb-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Totali i Shumës:</span>
                <span className="font-bold text-white">${totalStake.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-t border-slate-800/60 pt-2 font-bold">
                <span className="text-slate-300">Fitimi i Përgjithshëm:</span>
                <span className="text-emerald-400">${totalPotentialPayout.toFixed(2)}</span>
              </div>
            </div>

            {error && (
              <div className="text-rose-400 text-xs mb-4 bg-rose-950/30 p-3 rounded border border-rose-900/50">
                {error}
              </div>
            )}

            <button 
              onClick={handlePlaceBets}
              disabled={loading || totalStake <= 0 || isParlayDisabled}
              className={`btn-primary flex justify-center items-center gap-2 py-3 mt-auto ${(loading || totalStake <= 0 || isParlayDisabled) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Duke proçesuar...' : 'Vendos Bastin'}
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle2 size={64} className="text-emerald-400 mb-4 animate-bounce" />
            <h3 className="text-xl font-bold text-white mb-2">Baste u vendosën!</h3>
            <p className="text-slate-400 text-sm">Fat të mbarë!</p>
          </div>
        )}
      </div>
    </div>
  );
}
