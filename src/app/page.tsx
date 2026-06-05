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

  const finalGoalOutcomes = alternateGoals.length > 0 ? alternateGoals : totalsMarketOutcomes;
  const finalCornerOutcomes = alternateCorners; // Remove any invalid fallbacks like 'corners' !

  const groupedTotals = finalGoalOutcomes.length > 0 ? groupOutcomesByPoint(finalGoalOutcomes).slice(0, 8) : [];
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

  if (!h2hMarketOutcomes || h2hMarketOutcomes.length === 0) return null;

  const h2h = h2hMarketOutcomes;
  const homeOdd = h2h.find((o: any) => o.name === homeTeam) || h2h[0];
  const awayOdd = h2h.find((o: any) => o.name === awayTeam) || h2h[1];
  const drawOdd = h2h.find((o: any) => o.name === 'Draw') || { price: "N/A", name: 'Draw' };

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
    <div className="col-span-2 py-2 px-3 bg-slate-800/50 rounded-lg border border-slate-700/50 text-center">
      <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">[Tregu i Padisponueshëm]</span>
    </div>
  );

  const toggleExpand = async () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    if (newExpanded && !deepOdds && !isLoading) {
      setIsLoading(true);
      setDeepError(false);
      try {
        const res = await fetch(`/api/event/${match.id}?sport=${match.sport_key}`);
        if (res.ok) {
          const data = await res.json();
          if (!data || !data.bookmakers || data.bookmakers.length === 0) {
            console.warn("API returned empty payload or no bookmakers for this event");
            setDeepError(true);
          } else {
            console.log("Deep Odds payload keys:", Object.keys(data));
            console.log("Bookmakers length:", data.bookmakers.length);
            const activeBook = data.bookmakers[0];
            if (activeBook && activeBook.markets) {
              console.log(`Markets in ${activeBook.key}:`, activeBook.markets.map((m: any) => m.key));
            }
            setDeepOdds(data);
          }
        } else {
          setDeepError(true);
        }
      } catch (e) {
        console.error("Failed to load deep odds", e);
        setDeepError(true);
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-panel p-5 relative overflow-hidden group mb-4">
      <div className="cursor-pointer" onClick={toggleExpand}>
        <div className="flex justify-between items-center mb-4 relative z-10">
          <div className="flex gap-2 items-center">
            <span className="text-[11px] font-bold text-emerald-400 tracking-wide uppercase">
              {fullDateTime}
            </span>
          </div>
          <div className="text-slate-400">
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>

        <div className="flex justify-between items-center mb-5 relative z-10">
          <div className="text-white font-bold text-base md:text-lg flex-1 text-left">{homeTeam}</div>
          <div className="text-slate-500 font-bold text-xs mx-4">VS</div>
          <div className="text-white font-bold text-base md:text-lg flex-1 text-right">{awayTeam}</div>
        </div>
      </div>

      {/* CATEGORY A: MAIN MARKETS */}
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

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-6 animate-slide-up relative z-10">
          
          {isLoading ? (
            <div className="text-center py-8 text-emerald-400 font-bold animate-pulse text-sm tracking-widest uppercase">
              Duke ngarkuar tregjet...
            </div>
          ) : deepError ? (
            <div className="text-center py-8 bg-red-900/20 border border-red-500/50 rounded-xl p-6">
              <div className="text-red-400 font-bold mb-2">[Error Logged: Check Browser Inspector for Key Mismatches]</div>
              <p className="text-xs text-red-300/70 mb-4">The API returned an error status code or an empty payload for deep markets.</p>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setDeepError(false);
                  setDeepOdds({
                    bookmakers: [{
                      key: 'mock',
                      title: 'Mock Bookmaker',
                      markets: [
                        { key: 'h2h', outcomes: [{name: homeTeam, price: 2.1}, {name: 'Draw', price: 3.0}, {name: awayTeam, price: 2.8}] },
                        { key: 'draw_no_bet', outcomes: [{name: homeTeam, price: 1.5}, {name: awayTeam, price: 2.1}] },
                        { key: 'alternate_totals', outcomes: [
                          {name: 'Over', point: 1.5, price: 1.2}, {name: 'Under', point: 1.5, price: 4.5},
                          {name: 'Over', point: 2.5, price: 1.8}, {name: 'Under', point: 2.5, price: 1.95},
                          {name: 'Over', point: 3.5, price: 3.1}, {name: 'Under', point: 3.5, price: 1.3}
                        ]},
                        { key: 'btts', outcomes: [{name: 'Yes', price: 1.7}, {name: 'No', price: 2.1}] },
                        { key: 'alternate_spreads', outcomes: [
                          {name: homeTeam, point: -1.5, price: 2.1}, {name: awayTeam, point: 1.5, price: 1.65},
                          {name: homeTeam, point: -0.5, price: 1.8}, {name: awayTeam, point: 0.5, price: 1.95}
                        ]},
                        { key: 'totals_h1', outcomes: [
                          {name: 'Over', point: 0.5, price: 1.4}, {name: 'Under', point: 0.5, price: 2.7},
                          {name: 'Over', point: 1.5, price: 2.5}, {name: 'Under', point: 1.5, price: 1.5}
                        ]},
                        { key: 'h2h_h1', outcomes: [{name: homeTeam, price: 2.6}, {name: 'Draw', price: 2.1}, {name: awayTeam, price: 3.2}] },
                        { key: 'btts_both_halves', outcomes: [{name: 'Yes', price: 4.5}, {name: 'No', price: 1.15}] },
                        { key: 'correct_score', outcomes: [
                          {name: '1-0', price: 7.0}, {name: '2-0', price: 10.0}, {name: '2-1', price: 9.0},
                          {name: '0-0', price: 8.5}, {name: '1-1', price: 6.0}, {name: '2-2', price: 14.0},
                          {name: '0-1', price: 8.0}, {name: '0-2', price: 12.0}, {name: '1-2', price: 10.5}
                        ]},
                        { key: 'first_team_to_score', outcomes: [{name: homeTeam, price: 1.75}, {name: 'No Goal', price: 8.5}, {name: awayTeam, price: 2.05}] },
                        { key: 'h2h_btts', outcomes: [
                          {name: `${homeTeam} & Yes`, price: 4.2}, {name: `Draw & Yes`, price: 4.5}, {name: `${awayTeam} & Yes`, price: 5.5},
                          {name: `${homeTeam} & No`, price: 3.6}, {name: `Draw & No`, price: 9.0}, {name: `${awayTeam} & No`, price: 4.8}
                        ]}
                      ]
                    }]
                  });
                }}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-4 py-2 rounded font-bold text-xs uppercase tracking-wider transition-all"
              >
                Load Local Mock Data
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
  const [activeTab, setActiveTab] = useState<'live' | 'upcoming'>('upcoming');
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/odds?t=' + Date.now(), { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data)) {
        setMatches(data);
      } else {
        setMatches([]);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const getFilteredMatches = () => {
    const now = new Date().getTime();
    
    // Strict ISO time filter to remove expired matches instantly
    const validMatches = matches.filter(match => {
      const commenceTime = new Date(match.commence_time).getTime();
      return commenceTime > now;
    });

    const live = validMatches.filter(match => {
      const commenceTime = new Date(match.commence_time).getTime();
      // For the school project demo, we treat matches happening within the next 24 hours as "Live" 
      // because the free tier of The Odds API automatically drops matches once they actually start.
      return commenceTime <= now + 24 * 60 * 60 * 1000;
    });

    const upcoming = validMatches.filter(match => {
      const commenceTime = new Date(match.commence_time).getTime();
      return commenceTime > now + 24 * 60 * 60 * 1000;
    });

    if (activeTab === 'live') {
      return live;
    } else {
      return upcoming;
    }
  };

  const filteredMatches = getFilteredMatches();

  const groupedMatches = filteredMatches.reduce((acc: any, match: any) => {
    let title = match.sport_title || 'Të Tjera';
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
        </button>
        <button
          className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'upcoming' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          onClick={() => setActiveTab('upcoming')}
        >
          Ndeshjet e Ardhshme
        </button>
      </div>

      {loading ? (
        <div className="text-center p-12 text-slate-400">Duke kërkuar ndeshjet nga The Odds API...</div>
      ) : (
        <div className="space-y-8">
          {Object.keys(groupedMatches).length === 0 && (
            <div className="text-center p-8 text-slate-400">Asnjë ndeshje nuk u gjet për momentin.</div>
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
