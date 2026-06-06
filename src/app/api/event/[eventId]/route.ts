import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_KEY = process.env.THE_ODDS_API_KEY || '7eb70a0542253564fea557fca04f3f34';
const FOOTBALL_API_KEY = process.env.API_FOOTBALL_KEY || 'b54067ac3e5b52c34944cbb6a67ce08d';

const ALL_MARKETS = [
  'h2h', 'totals', 'btts', 'draw_no_bet', 'alternate_totals',
  'alternate_spreads', 'spreads', 'totals_h1', 'h2h_h1',
  'btts_both_halves', 'correct_score', 'first_team_to_score', 'h2h_btts',
].join(',');

function mergeBookmakers(bookmakers: any[], homeTeam: string, awayTeam: string) {
  const merged: Record<string, any> = {};
  for (const book of bookmakers) {
    for (const market of (book.markets || [])) {
      if (!merged[market.key]) merged[market.key] = { key: market.key, outcomes: [] };
      for (const outcome of (market.outcomes || [])) {
        const id = `${outcome.name}_${outcome.point ?? ''}`;
        const existing = merged[market.key].outcomes.find((o: any) => `${o.name}_${o.point ?? ''}` === id);
        if (!existing) merged[market.key].outcomes.push({ ...outcome });
        else if (outcome.price > existing.price) existing.price = outcome.price;
      }
    }
  }
  return [{ key: 'best_odds', title: 'Best Available', markets: Object.values(merged) }];
}

function transformFootballApiOdds(bookmakers: any[], homeTeam: string, awayTeam: string) {
  const markets: any[] = [];
  const seen = new Set<string>();

  for (const bk of bookmakers) {
    for (const bet of (bk.bets || [])) {
      if (seen.has(bet.name)) continue; // deduplicate across bookmakers
      seen.add(bet.name);
      const values: { value: string; odd: string }[] = bet.values || [];

      if (bet.name === 'Match Winner') {
        markets.push({
          key: 'h2h',
          outcomes: values.map((v: any) => ({
            name: v.value === 'Home' ? homeTeam : v.value === 'Away' ? awayTeam : 'Draw',
            price: parseFloat(v.odd),
          })),
        });
      } else if (bet.name === 'Goals Over/Under') {
        markets.push({
          key: 'totals',
          outcomes: values.map((v: any) => {
            const p = v.value.split(' ');
            return { name: p[0], point: parseFloat(p[1] || '2.5'), price: parseFloat(v.odd) };
          }),
        });
      } else if (bet.name === 'Goals Over/Under First Half') {
        markets.push({
          key: 'totals_h1',
          outcomes: values.map((v: any) => {
            const p = v.value.split(' ');
            return { name: p[0], point: parseFloat(p[1] || '0.5'), price: parseFloat(v.odd) };
          }),
        });
      } else if (bet.name === 'Both Teams Score') {
        markets.push({
          key: 'btts',
          outcomes: values.map((v: any) => ({ name: v.value, price: parseFloat(v.odd) })),
        });
      } else if (bet.name === 'Double Chance') {
        markets.push({
          key: 'draw_no_bet',
          outcomes: values.map((v: any) => ({
            name: v.value === '1X' ? `${homeTeam} or Draw` : v.value === 'X2' ? `${awayTeam} or Draw` : v.value,
            price: parseFloat(v.odd),
          })),
        });
      } else if (bet.name === 'Exact Score') {
        markets.push({
          key: 'correct_score',
          outcomes: values.map((v: any) => ({ name: v.value, price: parseFloat(v.odd) })),
        });
      } else if (bet.name === 'First Half Winner') {
        markets.push({
          key: 'h2h_h1',
          outcomes: values.map((v: any) => ({
            name: v.value === 'Home' ? homeTeam : v.value === 'Away' ? awayTeam : 'Draw',
            price: parseFloat(v.odd),
          })),
        });
      } else if (bet.name === 'Asian Handicap') {
        markets.push({
          key: 'spreads',
          outcomes: values.map((v: any) => {
            const p = v.value.split(' ');
            return { name: p[0] === 'Home' ? homeTeam : awayTeam, point: parseFloat(p[1] || '0'), price: parseFloat(v.odd) };
          }),
        });
      }
    }
  }
  return markets;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const { searchParams } = new URL(request.url);
  const sportKey = searchParams.get('sport') || 'soccer_epl';

  // ── API-Football path (for live matches from api-football.com) ─────────────
  if (eventId.startsWith('apifootball_')) {
    const fixtureId = eventId.replace('apifootball_', '');
    try {
      const [fixtureRes, oddsRes] = await Promise.all([
        fetch(`https://v3.football.api-sports.io/fixtures?id=${fixtureId}`, {
          headers: { 'x-apisports-key': FOOTBALL_API_KEY }, cache: 'no-store',
        }),
        fetch(`https://v3.football.api-sports.io/odds?fixture=${fixtureId}`, {
          headers: { 'x-apisports-key': FOOTBALL_API_KEY }, cache: 'no-store',
        }),
      ]);

      const fixtureData = await fixtureRes.json();
      const oddsData = await oddsRes.json();
      const fixture = fixtureData.response?.[0];
      if (!fixture) return NextResponse.json(null);

      const homeTeam = fixture.teams.home.name;
      const awayTeam = fixture.teams.away.name;
      const allBets: any[] = (oddsData.response || []).flatMap((r: any) => r.bookmakers || []);

      if (allBets.length === 0) {
        console.log(`[Event] No API-Football odds for fixture ${fixtureId}`);
        return NextResponse.json(null);
      }

      const markets = transformFootballApiOdds(allBets, homeTeam, awayTeam);
      console.log(`[Event] API-Football ${fixtureId}: ${allBets.length} bookmakers, ${markets.length} markets`);

      return NextResponse.json({
        id: eventId,
        sport_title: fixture.league.name,
        home_team: homeTeam,
        away_team: awayTeam,
        commence_time: fixture.fixture.date,
        bookmakers: [{ key: 'best_odds', title: 'Best Available', markets }],
      });
    } catch (err: any) {
      console.error('[Event] API-Football error:', err.message);
      return NextResponse.json(null);
    }
  }

  // ── The Odds API path (for upcoming matches) ───────────────────────────────
  try {
    let res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${eventId}/odds?apiKey=${API_KEY}&regions=eu,uk,us,au&markets=${ALL_MARKETS}&oddsFormat=decimal`,
      { cache: 'no-store' }
    );
    if (res.status === 422) {
      res = await fetch(
        `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${eventId}/odds?apiKey=${API_KEY}&regions=eu,uk,us,au&markets=h2h,totals,btts,draw_no_bet,alternate_totals,spreads&oddsFormat=decimal`,
        { cache: 'no-store' }
      );
    }
    if (res.status === 422) {
      res = await fetch(
        `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${eventId}/odds?apiKey=${API_KEY}&regions=eu,uk&markets=h2h,totals,btts,draw_no_bet&oddsFormat=decimal`,
        { cache: 'no-store' }
      );
    }
    if (!res.ok) {
      console.warn(`[Event] HTTP ${res.status} for event ${eventId}`);
      return NextResponse.json(null);
    }

    const data = await res.json();
    const bookmakers = data?.bookmakers || [];
    if (bookmakers.length === 0) return NextResponse.json(null);

    const marketKeys = [...new Set(bookmakers.flatMap((b: any) => (b.markets || []).map((m: any) => m.key)))];
    console.log(`[Event] ${eventId}: ${bookmakers.length} bookmakers, markets: ${marketKeys.join(', ')}`);

    return NextResponse.json({ ...data, bookmakers: mergeBookmakers(bookmakers, data.home_team, data.away_team) });
  } catch (err: any) {
    console.error('[Event] Error:', err.message);
    return NextResponse.json({ error: 'Failed to load event odds' }, { status: 500 });
  }
}
