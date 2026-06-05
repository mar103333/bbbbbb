const https = require('https');

const API_KEY = '8c4b70494116f2b8f12108f8765c2e3f';
const LEAGUES = [
  'soccer_epl',
  'soccer_uefa_champs_league',
  'soccer_spain_la_liga',
  'soccer_germany_bundesliga'
];

const fetchLeague = (leagueKey) => {
  return new Promise((resolve) => {
    const url = `https://api.the-odds-api.com/v4/sports/${leagueKey}/odds/?apiKey=${API_KEY}&regions=uk,eu&markets=h2h,totals,spreads&oddsFormat=decimal`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ leagueKey, status: res.statusCode, data: json });
        } catch (e) {
          resolve({ leagueKey, status: res.statusCode, error: 'Parse Error' });
        }
      });
    }).on('error', (e) => {
      resolve({ leagueKey, status: 500, error: e.message });
    });
  });
};

(async () => {
  console.log("Testing The Odds API...");
  for (const league of LEAGUES) {
    console.log(`Fetching ${league}...`);
    const result = await fetchLeague(league);
    console.log(`Status: ${result.status}`);
    if (result.status === 200) {
      if (Array.isArray(result.data)) {
        console.log(`Found ${result.data.length} matches.`);
        if (result.data.length > 0) {
          console.log(`Sample match: ${result.data[0].home_team} vs ${result.data[0].away_team}`);
        }
      } else {
        console.log(`Response is not an array:`, result.data);
      }
    } else {
      console.log(`Error Response:`, result.data);
    }
    console.log("------------------------");
  }
})();
