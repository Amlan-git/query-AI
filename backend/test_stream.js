const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/quest_ask',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
}, (res) => {
  res.on('data', (chunk) => {
    console.log("CHUNK:", chunk.toString());
  });
  res.on('end', () => {
    console.log("END");
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(JSON.stringify({ query: "Hello" }));
req.end();
