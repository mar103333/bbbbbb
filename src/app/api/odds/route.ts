import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const API_KEY = process.env.THE_ODDS_API_KEY || '7eb70a0542253564fea557fca04f3f34';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_FILE = path.join(process.cwd(), '.odds-cache.json');

const LEAGUES = [
  'soccer_brazil_campeonato',
  'soccer_brazil_serie_b',
  'soccer_chile_campeonato',
  'soccer_conmebol_copa_libertadores',
  'soccer_conmebol_copa_sudamericana',
  'soccer_china_superleague',
  'soccer_sweden_allsvenskan',
  'soccer_sweden_superettan',
  'soccer_finland_veikkausliiga',
  'soccer_norway_eliteserien',
  'soccer_league_of_ireland',
  'soccer_spain_segunda_division',
  'soccer_fifa_world_cup',
];

function readCache(): { matches: any[]; timestamp: number } | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch { return null; }
}

function writeCache(matches: any[]) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ matches, timestamp: Date.now() }), 'utf-8');
  } catch (e: any) { console.warn('[Odds] Cache write failed:', e.message); }
}

let fetchInProgress = false;

async function fetchAllMatches(): Promise<any[]> {
  // Check filesystem cache first
  const cached = readCache();
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[Odds] File cache hit — ${cached.matches.length} matches (${Math.round((CACHE_TTL_MS - (Date.now() - cached.timestamp)) / 1000)}s remaining)`);
    return cached.matches;
  }

  // Prevent concurrent fetches stomping each other
  if (fetchInProgress) {
    console.log('[Odds] Fetch in progress — returning stale cache');
    return cached?.matches || [];
  }

  fetchInProgress = true;
  console.log(`[Odds] Fetching fresh data from ${LEAGUES.length} leagues...`);

  try {
    const allMatches: any[] = [];

    for (let i = 0; i < LEAGUES.length; i += 4) {
      const batch = LEAGUES.slice(i, i + 4);
      const results = await Promise.all(
        batch.map(async (league) => {
          try {
            const url = `https://api.the-odds-api.com/v4/sports/${league}/odds/?apiKey=${API_KEY}&regions=eu,uk&markets=h2h&oddsFormat=decimal`;
            const r = await fetch(url, { cache: 'no-store' });
            if (!r.ok) { console.warn(`[Odds] ${league}: HTTP ${r.status}`); return []; }
            const d = await r.json();
            return Array.isArray(d) ? d : [];
          } catch { return []; }
        })
      );
      allMatches.push(...results.flat());
      if (i + 4 < LEAGUES.length) await new Promise(r => setTimeout(r, 400));
    }

    const valid = allMatches.filter((m: any) => m.bookmakers?.length > 0);
    console.log(`[Odds] Fetched ${valid.length} real matches`);

    if (valid.length > 0) {
      writeCache(valid);
      return valid;
    }

    // API returned nothing — serve stale cache rather than blank
    if (cached?.matches?.length) {
      console.warn('[Odds] API returned 0 — serving stale file cache');
      return cached.matches;
    }

    return [];
  } finally {
    fetchInProgress = false;
  }
}

export async function GET() {
  try {
    const matches = await fetchAllMatches();
    return NextResponse.json(matches);
  } catch (err: any) {
    console.error('[Odds] Fatal:', err.message);
    const cached = readCache();
    return NextResponse.json(cached?.matches || []);
  }
}
