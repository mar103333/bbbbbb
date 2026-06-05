const https = require('https');

const sportKey = 'soccer_brazil_campeonato';
const eventId = 'f4080730439de4ccf01dadabc9a7ccc6';
const API_KEY = '8c4b70494116f2b8f12108f8765c2e3f';

const primaryUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${eventId}/odds?apiKey=${API_KEY}&regions=eu,uk&markets=h2h,totals,btts,draw_no_bet,alternate_totals,alternate_spreads,totals_h1,h2h_h1&oddsFormat=decimal`;

https.get(primaryUrl, (res) => {
  console.log('STATUS:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('BODY:', data);
  });
}).on('error', err => {
  console.error('ERROR:', err);
});
