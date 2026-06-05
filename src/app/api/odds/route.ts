import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_KEY = process.env.THE_ODDS_API_KEY || '5c8961cbba10912b732a3ef202f391c6';
const LEAGUES = [
  'soccer_brazil_campeonato',
  'soccer_fifa_world_cup',
  'soccer_japan_j_league',
  'soccer_sweden_allsvenskan'
];

export async function GET(request: Request) {
  if (!API_KEY) {
    console.error("Missing THE_ODDS_API_KEY");
    return NextResponse.json([]);
  }

  try {
    const fetchLeagueOdds = async (leagueKey: string) => {
      const commenceTimeFrom = new Date().toISOString().split('.')[0] + 'Z';
      const primaryUrl = `https://api.the-odds-api.com/v4/sports/${leagueKey}/odds/?apiKey=${API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal&commenceTimeFrom=${commenceTimeFrom}`;
      
      let res = await fetch(primaryUrl, { next: { revalidate: 60 } });

      if (!res.ok) {
        console.warn(`Failed to fetch for ${leagueKey}`);
        return [];
      }
      return await res.json();
    };

    const results = await Promise.all(LEAGUES.map(league => fetchLeagueOdds(league)));
    const allMatches = results.flat();

    // Map The Odds API response to our unified format so the frontend doesn't need to change its shape drastically, 
    // or just return the raw data and let the frontend handle it.
    // The Odds API format:
    // { id, sport_key, sport_title, commence_time, home_team, away_team, bookmakers: [ { key, title, last_update, markets: [...] } ] }
    
    // Filter out matches that don't have bookmakers or have already started/finished if needed,
    // though the API automatically filters out finished matches.
    const validMatches = allMatches.filter(m => m.bookmakers && m.bookmakers.length > 0);

    if (validMatches.length === 0) {
      console.warn("No matches found from API or API quota exceeded. Using mock data.");
      
      const liveTime = new Date(Date.now() + 3600 * 1000).toISOString();
      const upcomingTime = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
      const mockBookmaker = (home: string, away: string) => [{
        key: 'bet365',
        title: 'Bet365',
        markets: [{ key: 'h2h', outcomes: [{name: home, price: 2.1}, {name: 'Draw', price: 3.0}, {name: away, price: 2.8}] }]
      }];

      return NextResponse.json([
        { id: 'mock_match_1', sport_key: 'soccer_fifa_world_cup', sport_title: 'FIFA World Cup', commence_time: liveTime, home_team: 'Brazil', away_team: 'Argentina', bookmakers: mockBookmaker('Brazil', 'Argentina') },
        { id: 'mock_match_2', sport_key: 'soccer_epl', sport_title: 'Premier League', commence_time: upcomingTime, home_team: 'Arsenal', away_team: 'Chelsea', bookmakers: mockBookmaker('Arsenal', 'Chelsea') },
        { id: 'mock_match_3', sport_key: 'soccer_epl', sport_title: 'Premier League', commence_time: liveTime, home_team: 'Manchester City', away_team: 'Liverpool', bookmakers: mockBookmaker('Manchester City', 'Liverpool') },
        { id: 'mock_match_4', sport_key: 'soccer_epl', sport_title: 'Premier League', commence_time: upcomingTime, home_team: 'Manchester Utd', away_team: 'Tottenham', bookmakers: mockBookmaker('Manchester Utd', 'Tottenham') },
        { id: 'mock_match_5', sport_key: 'soccer_spain_la_liga', sport_title: 'La Liga', commence_time: liveTime, home_team: 'Real Madrid', away_team: 'Barcelona', bookmakers: mockBookmaker('Real Madrid', 'Barcelona') },
        { id: 'mock_match_6', sport_key: 'soccer_spain_la_liga', sport_title: 'La Liga', commence_time: upcomingTime, home_team: 'Atletico Madrid', away_team: 'Sevilla', bookmakers: mockBookmaker('Atletico Madrid', 'Sevilla') },
        { id: 'mock_match_7', sport_key: 'soccer_italy_serie_a', sport_title: 'Serie A', commence_time: liveTime, home_team: 'Juventus', away_team: 'AC Milan', bookmakers: mockBookmaker('Juventus', 'AC Milan') },
        { id: 'mock_match_8', sport_key: 'soccer_italy_serie_a', sport_title: 'Serie A', commence_time: upcomingTime, home_team: 'Inter Milan', away_team: 'Napoli', bookmakers: mockBookmaker('Inter Milan', 'Napoli') },
        { id: 'mock_match_9', sport_key: 'soccer_germany_bundesliga', sport_title: 'Bundesliga', commence_time: liveTime, home_team: 'Bayern Munich', away_team: 'Borussia Dortmund', bookmakers: mockBookmaker('Bayern Munich', 'Borussia Dortmund') },
        { id: 'mock_match_10', sport_key: 'soccer_germany_bundesliga', sport_title: 'Bundesliga', commence_time: upcomingTime, home_team: 'Bayer Leverkusen', away_team: 'RB Leipzig', bookmakers: mockBookmaker('Bayer Leverkusen', 'RB Leipzig') },
        { id: 'mock_match_11', sport_key: 'soccer_france_ligue_one', sport_title: 'Ligue 1', commence_time: liveTime, home_team: 'PSG', away_team: 'Marseille', bookmakers: mockBookmaker('PSG', 'Marseille') },
        { id: 'mock_match_12', sport_key: 'soccer_france_ligue_one', sport_title: 'Ligue 1', commence_time: upcomingTime, home_team: 'Lyon', away_team: 'Monaco', bookmakers: mockBookmaker('Lyon', 'Monaco') },
        { id: 'mock_match_13', sport_key: 'soccer_usa_mls', sport_title: 'MLS', commence_time: liveTime, home_team: 'Inter Miami', away_team: 'LA Galaxy', bookmakers: mockBookmaker('Inter Miami', 'LA Galaxy') },
        { id: 'mock_match_14', sport_key: 'soccer_usa_mls', sport_title: 'MLS', commence_time: upcomingTime, home_team: 'New York City FC', away_team: 'Seattle Sounders', bookmakers: mockBookmaker('New York City FC', 'Seattle Sounders') },
        { id: 'mock_match_15', sport_key: 'soccer_brazil_campeonato', sport_title: 'Campeonato Brasileiro', commence_time: liveTime, home_team: 'Flamengo', away_team: 'Palmeiras', bookmakers: mockBookmaker('Flamengo', 'Palmeiras') },
        { id: 'mock_match_16', sport_key: 'soccer_brazil_campeonato', sport_title: 'Campeonato Brasileiro', commence_time: upcomingTime, home_team: 'Sao Paulo', away_team: 'Corinthians', bookmakers: mockBookmaker('Sao Paulo', 'Corinthians') }
      ]);
    }

    return NextResponse.json(validMatches);

  } catch (err: any) {
    console.error('The Odds API Error:', err.message);
    return NextResponse.json({ error: 'Failed to load matches' }, { status: 500 });
  }
}
