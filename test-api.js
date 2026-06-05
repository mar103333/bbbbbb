const https = require('https');

const API_KEY = 'b38f071b996d4c0aa5fc70574e638dfd';
const BASE_URL = 'v3.football.api-sports.io';

const options = {
  hostname: BASE_URL,
  path: '/fixtures?live=all',
  method: 'GET',
  headers: {
    'x-apisports-key': API_KEY
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log("LIVE MATCHES RESPONSE:");
    try {
      const json = JSON.parse(data);
      console.log(`Results: ${json.results}, Errors: ${JSON.stringify(json.errors)}`);
      if (json.response && json.response.length > 0) {
        console.log(`First match ID: ${json.response[0].fixture.id}, Status: ${json.response[0].fixture.status.short}`);
      }
    } catch (e) {
      console.log(data);
    }
    
    // Now fetch today's matches
    const today = new Date().toISOString().split('T')[0];
    const opts2 = { ...options, path: `/fixtures?date=${today}` };
    const req2 = https.request(opts2, (res2) => {
      let data2 = '';
      res2.on('data', (chunk) => data2 += chunk);
      res2.on('end', () => {
        console.log("\nTODAY MATCHES RESPONSE:");
        try {
          const json2 = JSON.parse(data2);
          console.log(`Results: ${json2.results}, Errors: ${JSON.stringify(json2.errors)}`);
          if (json2.response && json2.response.length > 0) {
            console.log(`First match ID: ${json2.response[0].fixture.id}, Status: ${json2.response[0].fixture.status.short}`);
          }
        } catch (e) {
          console.log(data2);
        }
      });
    });
    req2.end();
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.end();
