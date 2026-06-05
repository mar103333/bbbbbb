const LEAGUES = ['soccer_brazil_campeonato','soccer_fifa_world_cup','soccer_japan_j_league','soccer_sweden_allsvenskan'];
const https = require('https');
const API_KEY = '8c4b70494116f2b8f12108f8765c2e3f';

Promise.all(LEAGUES.map(l => new Promise(r => {
  https.get(`https://api.the-odds-api.com/v4/sports/${l}/odds/?apiKey=${API_KEY}&regions=uk,eu&markets=h2h`, res => {
    let d = '';
    res.on('data', c => d+=c);
    res.on('end', () => r(JSON.parse(d)));
  });
}))).then(res => {
  const all = res.flat();
  const now = Date.now();
  const live = all.filter(m => new Date(m.commence_time).getTime() <= now);
  console.log('Total matches:', all.length, 'Live matches:', live.length);
  console.log('Current time:', new Date(now).toISOString());
  if (all.length > 0) {
    console.log('Earliest match:', all.map(m => m.commence_time).sort()[0]);
  }
});
