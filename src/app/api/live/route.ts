import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ODDS_API_KEY = process.env.THE_ODDS_API_KEY || '7eb70a0542253564fea557fca04f3f34';
const FOOTBALL_API_KEY = process.env.API_FOOTBALL_KEY || 'b54067ac3e5b52c34944cbb6a67ce08d';

let cachedLive: any[] | null = null;
let liveCacheTimestamp = 0;
const LIVE_CACHE_TTL = 60 * 1000; // refresh every 60 seconds

async function fetchOddsLiveMap(): Promise<Map<string, any>> {
  // Fetch live odds from The Odds API for any match with bookmaker pricing
  // Uses the special 'upcoming' key which returns live + next 8 upcoming
  const oddsMap = new Map<string, any>(); // keyed by "home_team|away_team"
  try {
    const r = await fetch(
      `https://api.the-odds-api.com/v4/sports/upcoming/odds?apiKey=${ODDS_API_KEY}&regions=eu,uk&markets=h2h&oddsFormat=decimal`,
      { cache: 'no-store' }
    );
    if (!r.ok) return oddsMap;
    const data = await r.json();
    if (!Array.isArray(data)) return oddsMap;
    const now = Date.now();
    data
      .filter((m: any) => new Date(m.commence_time).getTime() <= now && m.bookmakers?.length > 0)
      .forEach((m: any) => {
        const key = `${m.home_team}|${m.away_team}`.toLowerCase();
        oddsMap.set(key, m);
      });
    console.log(`[Live] Odds map: ${oddsMap.size} live matches with odds`);
  } catch (e: any) {
    console.warn('[Live] Odds fetch failed:', e.message);
  }
  return oddsMap;
}

export async function GET() {
  try {
    if (cachedLive && Date.now() - liveCacheTimestamp < LIVE_CACHE_TTL) {
      console.log(`[Live] Cache hit — ${cachedLive.length} live matches`);
      return NextResponse.json(cachedLive);
    }

    // Fetch all live fixtures from API-Football and live odds from The Odds API in parallel
    const [footballRes, oddsMap] = await Promise.all([
      fetch('https://v3.football.api-sports.io/fixtures?live=all', {
        headers: { 'x-apisports-key': FOOTBALL_API_KEY },
        cache: 'no-store',
      }),
      fetchOddsLiveMap(),
    ]);

    if (!footballRes.ok) {
      console.warn('[Live] API-Football returned', footballRes.status);
      return NextResponse.json(cachedLive || []);
    }

    const footballData = await footballRes.json();
    const fixtures: any[] = footballData.response || [];

    console.log(`[Live] API-Football: ${fixtures.length} live fixtures`);

    // Transform API-Football format → our app format
    const liveMatches = fixtures.map((f: any) => {
      const homeTeam = f.teams.home.name;
      const awayTeam = f.teams.away.name;
      const homeScore = f.goals.home ?? 0;
      const awayScore = f.goals.away ?? 0;
      const elapsed = f.fixture.status.elapsed;

      // Try to match with The Odds API for bookmaker prices
      const oddsKey = `${homeTeam}|${awayTeam}`.toLowerCase();
      const oddsMatch = oddsMap.get(oddsKey);

      return {
        id: `apifootball_${f.fixture.id}`,
        sport_key: 'soccer',
        sport_title: f.league.name,
        league_country: f.league.country,
        league_logo: f.league.logo,
        home_logo: f.teams.home.logo,
        away_logo: f.teams.away.logo,
        commence_time: f.fixture.date,
        home_team: homeTeam,
        away_team: awayTeam,
        is_live: true,
        live_scores: [
          { name: homeTeam, score: String(homeScore) },
          { name: awayTeam, score: String(awayScore) },
        ],
        match_minute: elapsed ? `${elapsed}'` : null,
        fixture_status: f.fixture.status.short, // 1H, HT, 2H, ET, P
        // Odds from The Odds API if available, else empty
        bookmakers: oddsMatch?.bookmakers || [],
        odds_event_id: oddsMatch?.id || null,
        odds_sport_key: oddsMatch?.sport_key || null,
      };
    });

    // Sort: matches with odds first, then by league
    liveMatches.sort((a, b) => {
      if (a.bookmakers.length > 0 && b.bookmakers.length === 0) return -1;
      if (a.bookmakers.length === 0 && b.bookmakers.length > 0) return 1;
      return a.sport_title.localeCompare(b.sport_title);
    });

    console.log(`[Live] Returning ${liveMatches.length} live matches (${liveMatches.filter(m => m.bookmakers.length > 0).length} with odds)`);

    cachedLive = liveMatches;
    liveCacheTimestamp = Date.now();

    return NextResponse.json(liveMatches);
  } catch (err: any) {
    console.error('[Live] Fatal:', err.message);
    return NextResponse.json(cachedLive || []);
  }
}
