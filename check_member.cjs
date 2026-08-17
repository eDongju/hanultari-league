const https = require('https');

https.get('https://firestore.googleapis.com/v1/projects/hanultari-league/databases/(default)/documents/members', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const data = JSON.parse(body);
    const psg = data.documents.find(d => d.fields.name.stringValue === '박성규');
    console.log('박성규 members DB data:', JSON.stringify(psg.fields, null, 2));
  });
});
