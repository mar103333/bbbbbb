"use client";
import React, { useEffect, useState } from 'react';
import { useUser } from '@/components/UserProvider';
import { ChevronDown, ChevronUp } from 'lucide-react';

const MatchCard = ({ match }: { match: any }) => {
  const [expanded, setExpanded] = useState(false);
  const [deepOdds, setDeepOdds] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [deepError, setDeepError] = useState(false);
  const { selections, addSelection } = useUser();

  const homeTeam = match.home_team;
  const awayTeam = match.away_team;
  const matchTime = match.commence_time;
  const leagueName = match.sport_title;

  const getBestMarket = (marketKey: string) => {
    const bookmakers = deepOdds?.bookmakers || match?.bookmakers;
    if (!bookmakers || !Array.isArray(bookmakers)) return null;
    
    const priorities = ['bet365', 'unibet', 'williamhill'];
    for (const p of priorities) {
      const book = bookmakers.find((b: any) => b?.key === p);
      if (book && book.markets) {
        const m = book.markets.find((m: any) => m?.key === marketKey);
        if (m && m.outcomes && m.outcomes.length > 0) return m;
      }
    }
    
    for (const book of bookmakers) {
      if (!book?.markets) continue;
      const m = book.markets.find((m: any) => m?.key === marketKey);
      if (m && m.outcomes && m.outcomes.length > 0) return m;
    }
    return null;
  };

  const groupOutcomesByPoint = (outcomes: any[]) => {
    if (!outcomes) return [];
    const grouped: Record<string, { over?: any, under?: any }> = {};
    outcomes.forEach(o => {
      const point = o?.point || '';
      if (!grouped[point]) grouped[point] = {};
      if (o?.name === 'Over') grouped[point].over = o;
      if (o?.name === 'Under') grouped[point].under = o;
    });
    return Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b)
      .map(k => ({ point: k, ...grouped[k] }));
  };

  // Safely extract markets from bookmaker
  const getBestBookmakerMarkets = () => {
    const bookmakers = deepOdds?.bookmakers || match?.bookmakers || [];
    if (!bookmakers || !Array.isArray(bookmakers)) return [];
    
    const priorities = ['bet365', 'unibet', 'williamhill'];
    for (const p of priorities) {
      const book = bookmakers.find((b: any) => b?.key === p);
      if (book && book.markets && Array.isArray(book.markets)) return book.markets;
    }
    
    if (bookmakers.length > 0 && bookmakers[0]?.markets && Array.isArray(bookmakers[0].markets)) {
      return bookmakers[0].markets;
    }
    return [];
  };

  const bookmakerMarkets = getBestBookmakerMarkets();
  
  const h2hMarketOutcomes = bookmakerMarkets.find((m: any) => m.key === 'h2h')?.outcomes || [];
  const totalsMarketOutcomes = bookmakerMarkets.find((m: any) => m.key === 'totals')?.outcomes || [];
  const bttsMarketOutcomes = bookmakerMarkets.find((m: any) => m.key === 'btts')?.outcomes || [];
  const dnbMarketOutcomes = bookmakerMarkets.find((m: any) => m.key === 'draw_no_bet')?.outcomes || [];
  const correctScoresOutcomes = bookmakerMarkets.find((m: any) => m.key === 'correct_score')?.outcomes || [];
  const halfTotalsOutcomes = bookmakerMarkets.find((m: any) => m.key === 'totals_h1')?.outcomes || [];
  const halfResultOutcomes = bookmakerMarkets.find((m: any) => m.key === 'h2h_h1')?.outcomes || [];
  const bttsBothHalvesOutcomes = bookmakerMarkets.find((m: any) => m.key === 'btts_both_halves')?.outcomes || [];
  const firstTeamToScoreOutcomes = bookmakerMarkets.find((m: any) => m.key === 'first_team_to_score' || m.key === 'first_team_score' || m.key === 'team_to_score_first')?.outcomes || [];
  const h2hBttsComboOutcomes = bookmakerMarkets.find((m: any) => m.key === 'h2h_btts' || m.key === 'h2h_both_teams_to_score')?.outcomes || [];
  const alternateSpreadsOutcomes = bookmakerMarkets.find((m: any) => m.key === 'alternate_spreads')?.outcomes || [];

  // Split alternate_totals into Goals (0.5 to 6.5) and Corners (7.5 to 14.5)
  const allAltTotals = bookmakerMarkets.find((m: any) => m.key === 'alternate_totals')?.outcomes || [];
  
  const alternateGoals = allAltTotals.filter((o: any) => o.point <= 6.5);
  const alternateCorners = allAltTotals.filter((o: any) => o.point >= 7.5);

  // Calculate current total goals for live matches (to filter out settled lines)
  const currentTotalGoals = match.is_live && match.live_scores && match.live_scores.length > 0
    ? match.live_scores.reduce((sum: number, s: any) => sum + parseInt(s.score || '0', 10), 0)
    : null;

  const finalGoalOutcomes = alternateGoals.length > 0 ? alternateGoals : totalsMarketOutcomes;
  const finalCornerOutcomes = alternateCorners;

  // Filter settled lines: hide Over/Under X when current goals > X (already determined)
  const filteredGoalOutcomes = currentTotalGoals !== null
    ? finalGoalOutcomes.filter((o: any) => o.point > currentTotalGoals)
    : finalGoalOutcomes;

  const groupedTotals = filteredGoalOutcomes.length > 0 ? groupOutcomesByPoint(filteredGoalOutcomes).slice(0, 8) : [];
  const groupedCorners = finalCornerOutcomes.length > 0 ? groupOutcomesByPoint(finalCornerOutcomes).slice(0, 15) : [];
  const groupedTotalsQ1 = halfTotalsOutcomes.length > 0 ? groupOutcomesByPoint(halfTotalsOutcomes).slice(0, 5) : [];

  const groupSpreadsByPoint = (outcomes: any[]) => {
    if (!outcomes) return [];
    const grouped: Record<string, { home?: any, away?: any }> = {};
    outcomes.forEach(o => {
      const point = Math.abs(o?.point || 0);
      if (!grouped[point]) grouped[point] = {};
      if (o?.name === homeTeam) grouped[point].home = o;
      if (o?.name === awayTeam) grouped[point].away = o;
    });
    return Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b)
      .map(k => ({ point: k, ...grouped[k] }));
  };
  const groupedSpreads = alternateSpreadsOutcomes.length > 0 ? groupSpreadsByPoint(alternateSpreadsOutcomes).slice(0, 10) : [];

  const hasOdds = h2hMarketOutcomes && h2hMarketOutcomes.length > 0;

  // For matches with no bookmaker odds (API-Football only), render score-only card
  if (!hasOdds && !match.is_live) return null;

  const h2h = h2hMarketOutcomes;
  const homeOdd = hasOdds ? (h2h.find((o: any) => o.name === homeTeam) || h2h[0]) : null;
  const awayOdd = hasOdds ? (h2h.find((o: any) => o.name === awayTeam) || h2h[1]) : null;
  const drawOdd = hasOdds ? (h2h.find((o: any) => o.name === 'Draw') || { price: "N/A", name: 'Draw' }) : null;

  const isSelected = (marketName: string, value: string) => {
    return selections.some((s) => s.matchId === match.id && s.market === marketName && s.outcomeName === value);
  };

  const handleSelect = (marketName: string, rawValue: string, odd: string) => {
    if (odd === 'N/A') return;
    addSelection({
      matchId: match.id,
      matchName: `${leagueName} | ${homeTeam} vs ${awayTeam}`,
      market: marketName,
      outcomeName: rawValue,
      odd: Number(odd)
    });
  };

  const dateObj = new Date(matchTime);
  const datePart = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(dateObj);
  const timePart = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const fullDateTime = `${datePart} ${timePart}`;

  const renderUnavailable = () => (
    <div className="col-span-2 py-2 px-3 bg-slate-800/30 rounded-lg border border-slate-700/30 text-center">
      <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">— Line Suspended —</span>
    </div>
  );

  const toggleExpand = async () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    if (newExpanded && !deepOdds && !isLoading) {
      setIsLoading(true);
      setDeepError(false);
      try {
        // Prefer Odds API event ID for live matches that have one (keeps live in-play odds accurate)
        // Fall back to apifootball_ ID for matches without Odds API coverage
        const eventId = match.odds_event_id || match.id;
        const sportKey = match.odds_sport_key || match.sport_key;
        const res = await fetch(`/api/event/${eventId}?sport=${sportKey}`);
        if (res.ok) {
          const data = await res.json();
          const bookmakers = data?.bookmakers || (Array.isArray(data) ? data[0]?.bookmakers : null) || [];
          if (bookmakers.length === 0) {
            console.warn(`[DeepOdds] Empty bookmakers for event ${match.id}`);
            setDeepError(true);
          } else {
            console.log(`[DeepOdds] ${bookmakers.length} bookmaker(s) loaded`);
            console.log(`[DeepOdds] Markets:`, bookmakers[0]?.markets?.map((m: any) => m.key));
            setDeepOdds({ bookmakers });
          }
        } else {
          console.error(`[DeepOdds] HTTP ${res.status} for event ${match.id}`);
          setDeepError(true);
        }
      } catch (e) {
        console.error('[DeepOdds] Network error:', e);
        setDeepError(true);
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-panel p-5 relative overflow-hidden group mb-4">
      <div className="cursor-pointer" onClick={toggleExpand}>
        <div className="flex justify-between items-center mb-4 relative z-10">
          <div className="flex gap-2 items-center flex-wrap">
            {match.is_live && (
              <span className="flex items-center gap-1 bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
                {match.match_minute || 'LIVE'}
              </span>
            )}
            <span className="text-[11px] font-bold text-emerald-400 tracking-wide uppercase">
              {match.league_country ? `${match.league_country} — ` : ''}{fullDateTime}
            </span>
          </div>
          <div className="text-slate-400">
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>

        <div className="flex justify-between items-center mb-5 relative z-10">
          <div className="text-white font-bold text-base md:text-lg flex-1 text-left">{homeTeam}</div>
          {match.is_live && match.live_scores && match.live_scores.length > 0 ? (() => {
            const homeScore = match.live_scores.find((s: any) => s.name === match.home_team)?.score ?? '?';
            const awayScore = match.live_scores.find((s: any) => s.name === match.away_team)?.score ?? '?';
            return (
              <div className="flex flex-col items-center mx-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-white tabular-nums">{homeScore}</span>
                  <span className="text-slate-500 font-bold text-sm">-</span>
                  <span className="text-2xl font-black text-white tabular-nums">{awayScore}</span>
                </div>
                <span className="text-[9px] font-black text-red-400 tracking-widest uppercase animate-pulse mt-0.5">Live</span>
              </div>
            );
          })() : (
            <div className="text-slate-500 font-bold text-xs mx-4">VS</div>
          )}
          <div className="text-white font-bold text-base md:text-lg flex-1 text-right">{awayTeam}</div>
        </div>
      </div>

      {/* CATEGORY A: MAIN MARKETS */}
      {hasOdds ? (
        <div className="grid grid-cols-3 gap-3 relative z-10">
          <button
            className={`btn-odds ${isSelected('Match Winner', homeOdd.name) ? 'selected' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleSelect('Match Winner', homeOdd.name, homeOdd.price); }}
          >
            <span className="odd-label text-center leading-tight truncate px-1" title={homeTeam}>{homeTeam}</span>
            <span className="odd-value font-black text-white">{homeOdd.price !== 'N/A' ? Number(homeOdd.price).toFixed(2) : 'N/A'}</span>
          </button>
          <button
            className={`btn-odds ${isSelected('Match Winner', drawOdd.name) ? 'selected' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleSelect('Match Winner', drawOdd.name, drawOdd.price); }}
          >
            <span className="odd-label text-center leading-tight">Draw</span>
            <span className="odd-value font-black text-white">{drawOdd.price !== 'N/A' ? Number(drawOdd.price).toFixed(2) : 'N/A'}</span>
          </button>
          <button
            className={`btn-odds ${isSelected('Match Winner', awayOdd.name) ? 'selected' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleSelect('Match Winner', awayOdd.name, awayOdd.price); }}
          >
            <span className="odd-label text-center leading-tight truncate px-1" title={awayTeam}>{awayTeam}</span>
            <span className="odd-value font-black text-white">{awayOdd.price !== 'N/A' ? Number(awayOdd.price).toFixed(2) : 'N/A'}</span>
          </button>
        </div>
      ) : null}

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-6 animate-slide-up relative z-10">
          
          {isLoading ? (
            <div className="text-center py-8 text-emerald-400 font-bold animate-pulse text-sm tracking-widest uppercase">
              Duke ngarkuar tregjet...
            </div>
          ) : deepError ? (
            <div className="text-center py-8 bg-red-900/20 border border-red-500/50 rounded-xl p-6">
              <div className="text-red-400 font-bold mb-2 text-sm">Tregu i Thellë i Padisponueshëm</div>
              <p className="text-xs text-red-300/60 mb-4">Ky event nuk ka kuota të detajuara në dispozicion momentalisht.</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeepError(false);
                  setDeepOdds(null);
                  toggleExpand();
                }}
                className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-4 py-2 rounded font-bold text-xs uppercase tracking-wider transition-all"
              >
                Provo Përsëri
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">             {/* Category A Continued: Draw No Bet */}
            <div>
              <span className="text-xs text-slate-400 font-semibold mb-2 block uppercase tracking-wider">Draw No Bet</span>
              <div className="grid grid-cols-2 gap-3">
                {dnbMarketOutcomes.length > 0 ? dnbMarketOutcomes.slice(0, 2).map((val: any, idx: number) => {
                  const label = val.name === homeTeam ? homeTeam : (val.name === awayTeam ? awayTeam : val.name);
                  const isDisabled = val.price === 'N/A';
                  return (
                    <button key={idx} disabled={isDisabled} className={`btn-odds ${isSelected('Draw No Bet', val.name) ? 'selected' : ''} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => !isDisabled && handleSelect('Draw No Bet', val.name, val.price)}>
                      <span className="odd-label truncate px-1" title={label}>{label}</span>
                      <span className="odd-value font-black text-white">{Number(val.price).toFixed(2)}</span>
                    </button>
                  );
                }) : renderUnavailable()}
              </div>
            </div>
 
            {/* CATEGORY B: GOALS MARKETS */}
            <div>
              <span className="text-xs text-slate-400 font-semibold mb-2 block uppercase tracking-wider">Gola (Over/Under)</span>
              <div className="flex flex-col gap-2">
                {groupedTotals.length > 0 ? groupedTotals.map((group, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-3">
                    <button disabled={!group.over} className={`btn-odds ${group.over && isSelected('Goals Over/Under', `Over ${group.point}`) ? 'selected' : ''} ${!group.over ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => group.over && handleSelect('Goals Over/Under', `Over ${group.point}`, group.over.price)}>
                      <span className="odd-label">Mbi {group.point}</span>
                      <span className="odd-value font-black text-white">{group.over ? Number(group.over.price).toFixed(2) : 'N/A'}</span>
                    </button>
                    <button disabled={!group.under} className={`btn-odds ${group.under && isSelected('Goals Over/Under', `Under ${group.point}`) ? 'selected' : ''} ${!group.under ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => group.under && handleSelect('Goals Over/Under', `Under ${group.point}`, group.under.price)}>
                      <span className="odd-label">Nën {group.point}</span>
                      <span className="odd-value font-black text-white">{group.under ? Number(group.under.price).toFixed(2) : 'N/A'}</span>
                    </button>
                  </div>
                )) : renderUnavailable()}
              </div>
            </div>
 
            <div>
              <span className="text-xs text-slate-400 font-semibold mb-2 block uppercase tracking-wider">Shënojnë të Dyja (BTTS)</span>
              <div className="grid grid-cols-2 gap-3">
                {bttsMarketOutcomes.length > 0 ? bttsMarketOutcomes.slice(0, 2).map((val: any, idx: number) => {
                  const isDisabled = val.price === 'N/A';
                  return (
                    <button key={idx} disabled={isDisabled} className={`btn-odds ${isSelected('Both Teams Score', val.name) ? 'selected' : ''} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => !isDisabled && handleSelect('Both Teams Score', val.name, val.price)}>
                      <span className="odd-label">{val.name === 'Yes' ? 'Po' : 'Jo'}</span>
                      <span className="odd-value font-black text-white">{isDisabled ? 'N/A' : Number(val.price).toFixed(2)}</span>
                    </button>
                  );
                }) : renderUnavailable()}
              </div>
            </div>
 
            {/* CATEGORY C: SPECIAL PROPS */}
            <div>
              <span className="text-xs text-slate-400 font-semibold mb-2 block uppercase tracking-wider">Spreads (Handicap)</span>
              <div className="flex flex-col gap-2">
                {groupedSpreads.length > 0 ? groupedSpreads.map((group, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-3">
                    <button disabled={!group.home} className={`btn-odds ${group.home && isSelected('Spreads', `${homeTeam} ${group.home.point > 0 ? '+' : ''}${group.home.point}`) ? 'selected' : ''} ${!group.home ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => group.home && handleSelect('Spreads', `${homeTeam} ${group.home.point > 0 ? '+' : ''}${group.home.point}`, group.home.price)}>
                      <span className="odd-label">{homeTeam} {group.home.point > 0 ? '+' : ''}{group.home.point}</span>
                      <span className="odd-value font-black text-white">{group.home ? Number(group.home.price).toFixed(2) : 'N/A'}</span>
                    </button>
                    <button disabled={!group.away} className={`btn-odds ${group.away && isSelected('Spreads', `${awayTeam} ${group.away.point > 0 ? '+' : ''}${group.away.point}`) ? 'selected' : ''} ${!group.away ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => group.away && handleSelect('Spreads', `${awayTeam} ${group.away.point > 0 ? '+' : ''}${group.away.point}`, group.away.price)}>
                      <span className="odd-label">{awayTeam} {group.away.point > 0 ? '+' : ''}{group.away.point}</span>
                      <span className="odd-value font-black text-white">{group.away ? Number(group.away.price).toFixed(2) : 'N/A'}</span>
                    </button>
                  </div>
                )) : renderUnavailable()}
              </div>
            </div>
 
            {/* KORNE (CORNERS) */}
            <div>
              <span className="text-xs text-slate-400 font-semibold mb-2 block uppercase tracking-wider">Korne (Corners)</span>
              <div className="flex flex-col gap-2">
                {groupedCorners.length > 0 ? groupedCorners.map((group, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-3">
                    <button disabled={!group.over} className={`btn-odds ${group.over && isSelected('Corners Over/Under', `Over ${group.point}`) ? 'selected' : ''} ${!group.over ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => group.over && handleSelect('Corners Over/Under', `Over ${group.point}`, group.over.price)}>
                      <span className="odd-label">Mbi {group.point}</span>
                      <span className="odd-value font-black text-white">{group.over ? Number(group.over.price).toFixed(2) : 'N/A'}</span>
                    </button>
                    <button disabled={!group.under} className={`btn-odds ${group.under && isSelected('Corners Over/Under', `Under ${group.point}`) ? 'selected' : ''} ${!group.under ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => group.under && handleSelect('Corners Over/Under', `Under ${group.point}`, group.under.price)}>
                      <span className="odd-label">Nën {group.point}</span>
                      <span className="odd-value font-black text-white">{group.under ? Number(group.under.price).toFixed(2) : 'N/A'}</span>
                    </button>
                  </div>
                )) : renderUnavailable()}
              </div>
            </div>
 
            {/* 1st HALF RESULT */}
            <div>
              <span className="text-xs text-slate-400 font-semibold mb-2 block uppercase tracking-wider">Fituesi - Pjesa e Parë (1st Half Result)</span>
              <div className="grid grid-cols-3 gap-3">
                {halfResultOutcomes.length > 0 ? (() => {
                  const h2hQ1 = halfResultOutcomes;
                  const homeQ1 = h2hQ1.find((o: any) => o.name === homeTeam) || h2hQ1[0];
                  const awayQ1 = h2hQ1.find((o: any) => o.name === awayTeam) || h2hQ1[1];
                  const drawQ1 = h2hQ1.find((o: any) => o.name === 'Draw') || { price: "N/A", name: 'Draw' };
                  return (
                    <>
                      <button
                        className={`btn-odds ${isSelected('1st Half Result', homeQ1.name) ? 'selected' : ''}`}
                        onClick={() => handleSelect('1st Half Result', homeQ1.name, homeQ1.price)}
                      >
                        <span className="odd-label text-center leading-tight truncate px-1" title={homeTeam}>{homeTeam}</span>
                        <span className="odd-value font-black text-white">{homeQ1.price !== 'N/A' ? Number(homeQ1.price).toFixed(2) : 'N/A'}</span>
                      </button>
                      <button
                        className={`btn-odds ${isSelected('1st Half Result', drawQ1.name) ? 'selected' : ''}`}
                        onClick={() => handleSelect('1st Half Result', drawQ1.name, drawQ1.price)}
                      >
                        <span className="odd-label text-center leading-tight">Draw</span>
                        <span className="odd-value font-black text-white">{drawQ1.price !== 'N/A' ? Number(drawQ1.price).toFixed(2) : 'N/A'}</span>
                      </button>
                      <button
                        className={`btn-odds ${isSelected('1st Half Result', awayQ1.name) ? 'selected' : ''}`}
                        onClick={() => handleSelect('1st Half Result', awayQ1.name, awayQ1.price)}
                      >
                        <span className="odd-label text-center leading-tight truncate px-1" title={awayTeam}>{awayTeam}</span>
                        <span className="odd-value font-black text-white">{awayQ1.price !== 'N/A' ? Number(awayQ1.price).toFixed(2) : 'N/A'}</span>
                      </button>
                    </>
                  );
                })() : renderUnavailable()}
              </div>
            </div>
 
            {/* 1st HALF TOTALS */}
            <div>
              <span className="text-xs text-slate-400 font-semibold mb-2 block uppercase tracking-wider">Gola - Pjesa e Parë (1st Half Totals)</span>
              <div className="flex flex-col gap-2">
                {groupedTotalsQ1.length > 0 ? groupedTotalsQ1.map((group, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-3">
                    <button disabled={!group.over} className={`btn-odds ${group.over && isSelected('1st Half Totals', `Over ${group.point}`) ? 'selected' : ''} ${!group.over ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => group.over && handleSelect('1st Half Totals', `Over ${group.point}`, group.over.price)}>
                      <span className="odd-label">Mbi {group.point}</span>
                      <span className="odd-value font-black text-white">{group.over ? Number(group.over.price).toFixed(2) : 'N/A'}</span>
                    </button>
                    <button disabled={!group.under} className={`btn-odds ${group.under && isSelected('1st Half Totals', `Under ${group.point}`) ? 'selected' : ''} ${!group.under ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => group.under && handleSelect('1st Half Totals', `Under ${group.point}`, group.under.price)}>
                      <span className="odd-label">Nën {group.point}</span>
                      <span className="odd-value font-black text-white">{group.under ? Number(group.under.price).toFixed(2) : 'N/A'}</span>
                    </button>
                  </div>
                )) : renderUnavailable()}
              </div>
            </div>
 
            {/* BTTS BOTH HALVES */}
            <div>
              <span className="text-xs text-slate-400 font-semibold mb-2 block uppercase tracking-wider">BTTS në të dyja Pjesët</span>
              <div className="grid grid-cols-2 gap-3">
                {bttsBothHalvesOutcomes.length > 0 ? bttsBothHalvesOutcomes.slice(0, 2).map((val: any, idx: number) => {
                  const isDisabled = val.price === 'N/A';
                  return (
                    <button key={idx} disabled={isDisabled} className={`btn-odds ${isSelected('BTTS Both Halves', val.name) ? 'selected' : ''} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => !isDisabled && handleSelect('BTTS Both Halves', val.name, val.price)}>
                      <span className="odd-label">{val.name === 'Yes' ? 'Po' : 'Jo'}</span>
                      <span className="odd-value font-black text-white">{isDisabled ? 'N/A' : Number(val.price).toFixed(2)}</span>
                    </button>
                  );
                }) : renderUnavailable()}
              </div>
            </div>
 
            {/* FIRST TEAM TO SCORE */}
            <div>
              <span className="text-xs text-slate-400 font-semibold mb-2 block uppercase tracking-wider">Skuadra që Shënon e Para</span>
              <div className="grid grid-cols-3 gap-3">
                {firstTeamToScoreOutcomes.length > 0 ? firstTeamToScoreOutcomes.map((val: any, idx: number) => {
                  const isDisabled = val.price === 'N/A';
                  return (
                    <button key={idx} disabled={isDisabled} className={`btn-odds ${isSelected('First Team to Score', val.name) ? 'selected' : ''} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => !isDisabled && handleSelect('First Team to Score', val.name, val.price)}>
                      <span className="odd-label truncate px-1" title={val.name}>{val.name}</span>
                      <span className="odd-value font-black text-white">{isDisabled ? 'N/A' : Number(val.price).toFixed(2)}</span>
                    </button>
                  );
                }) : renderUnavailable()}
              </div>
            </div>
 
            {/* 1X2 & BTTS COMBO */}
            <div>
              <span className="text-xs text-slate-400 font-semibold mb-2 block uppercase tracking-wider">1X2 & BTTS Combo</span>
              <div className="grid grid-cols-2 gap-3">
                {h2hBttsComboOutcomes.length > 0 ? h2hBttsComboOutcomes.map((val: any, idx: number) => {
                  const isDisabled = val.price === 'N/A';
                  return (
                    <button key={idx} disabled={isDisabled} className={`btn-odds ${isSelected('1X2 & BTTS Combo', val.name) ? 'selected' : ''} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => !isDisabled && handleSelect('1X2 & BTTS Combo', val.name, val.price)}>
                      <span className="odd-label text-[10px] truncate px-1" title={val.name}>{val.name}</span>
                      <span className="odd-value font-black text-white text-xs">{isDisabled ? 'N/A' : Number(val.price).toFixed(2)}</span>
                    </button>
                  );
                }) : renderUnavailable()}
              </div>
            </div>
 
            {/* CORRECT SCORE */}
            <div className="col-span-1 md:col-span-2">
              <span className="text-xs text-slate-400 font-semibold mb-2 block uppercase tracking-wider">Rezultati i Saktë (Correct Score)</span>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {correctScoresOutcomes.length > 0 ? correctScoresOutcomes.map((val: any, idx: number) => {
                  const isDisabled = val.price === 'N/A';
                  return (
                    <button key={idx} disabled={isDisabled} className={`btn-odds ${isSelected('Correct Score', val.name) ? 'selected' : ''} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => !isDisabled && handleSelect('Correct Score', val.name, val.price)}>
                      <span className="odd-label text-[10px] truncate px-1" title={val.name}>{val.name}</span>
                      <span className="odd-value font-black text-white text-xs">{isDisabled ? 'N/A' : Number(val.price).toFixed(2)}</span>
                    </button>
                  );
                }) : renderUnavailable()}
              </div>
            </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<'live' | 'upcoming'>('live');
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);
  const [liveMatches, setLiveMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);

  useEffect(() => {
    fetchUpcoming();
    fetchLive();
    // Refresh live every 60 seconds
    const interval = setInterval(fetchLive, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchUpcoming = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/odds', { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data)) {
        const now = Date.now();
        setUpcomingMatches(data.filter((m: any) => new Date(m.commence_time).getTime() > now));
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fetchLive = async () => {
    setLiveLoading(true);
    try {
      const res = await fetch('/api/live', { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data)) setLiveMatches(data);
    } catch (e) { console.error(e); }
    setLiveLoading(false);
  };

  const currentMatches = activeTab === 'live' ? liveMatches : upcomingMatches;
  const isLoading = activeTab === 'live' ? liveLoading : loading;

  const groupedMatches = currentMatches.reduce((acc: any, match: any) => {
    const title = match.sport_title || 'Të Tjera';
    if (!acc[title]) acc[title] = [];
    acc[title].push(match);
    return acc;
  }, {});

  return (
    <div className="space-y-6 pb-8 animate-slide-up">
      <div className="flex gap-2 glass-panel p-1.5 rounded-xl">
        <button
          className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'live' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          onClick={() => setActiveTab('live')}
        >
          Ndeshjet Live
          {liveMatches.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block"></span>
              <span className={`text-xs font-black ${activeTab === 'live' ? 'text-white' : 'text-red-400'}`}>{liveMatches.length}</span>
            </span>
          )}
        </button>
        <button
          className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'upcoming' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          onClick={() => setActiveTab('upcoming')}
        >
          Ndeshjet e Ardhshme
          {upcomingMatches.length > 0 && (
            <span className={`ml-2 text-xs font-black ${activeTab === 'upcoming' ? 'text-white/80' : 'text-slate-500'}`}>{upcomingMatches.length}</span>
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="text-center p-12 text-slate-400">
          {activeTab === 'live' ? 'Duke kërkuar ndeshjet live...' : 'Duke kërkuar ndeshjet nga API...'}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.keys(groupedMatches).length === 0 && (
            <div className="text-center p-10">
              {activeTab === 'live' ? (
                <div className="space-y-2">
                  <div className="text-2xl">⚽</div>
                  <p className="text-slate-300 font-semibold">Asnjë ndeshje live momentalisht</p>
                  <p className="text-slate-500 text-sm">Shko te "Ndeshjet e Ardhshme" për të parë ndeshjet e planifikuara</p>
                  <button
                    onClick={() => setActiveTab('upcoming')}
                    className="mt-3 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm font-bold transition-all"
                  >
                    Shiko Ndeshjet e Ardhshme →
                  </button>
                </div>
              ) : (
                <p className="text-slate-400">Asnjë ndeshje nuk u gjet për momentin.</p>
              )}
            </div>
          )}

          {Object.keys(groupedMatches).map(league => (
            <div key={league}>
              <h2 className="text-sm font-black text-emerald-400 mb-3 ml-2 tracking-wide uppercase">{league}</h2>
              {groupedMatches[league].map((match: any) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
