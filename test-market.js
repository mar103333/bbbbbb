const https = require('https');
const API_KEY = '8c4b70494116f2b8f12108f8765c2e3f';
const leagueKey = 'soccer_brazil_campeonato';
const url = `https://api.the-odds-api.com/v4/sports/${leagueKey}/odds/?apiKey=${API_KEY}&regions=eu,us&markets=h2h,totals,btts,draw_no_bet&oddsFormat=decimal`;

https.get(url, res => {
  let d = '';
  res.on('data', c => d+=c);
  res.on('end', () => console.log(res.statusCode, JSON.parse(d)));
});
