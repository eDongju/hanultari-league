const https = require('https');

https.get('https://firestore.googleapis.com/v1/projects/hanultari-league/databases/(default)/documents/sessions', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const data = JSON.parse(body);
    let gSum = 0;
    let rSum = 0;
    let details = [];
    
    data.documents.forEach(d => {
      if(d.fields && d.fields.pointHistory && d.fields.pointHistory.arrayValue && d.fields.pointHistory.arrayValue.values) {
        d.fields.pointHistory.arrayValue.values.forEach(v => {
          const m = v.mapValue.fields;
          if(m.memberName && m.memberName.stringValue === '박성규') {
            const amount = parseInt(m.amount.integerValue);
            if (m.type.stringValue === 'G') {
              gSum += amount;
            } else if (m.type.stringValue === 'R') {
              rSum += amount;
            }
            details.push(`${d.name.split('/').pop()} - ${m.type.stringValue}: ${m.description.stringValue} (${amount})`);
          }
        });
      }
    });
    console.log('박성규 Points Breakdown:');
    console.log(details.join('\n'));
    console.log(`Total G.PT: ${gSum}`);
    console.log(`Total R.PT: ${rSum}`);
  });
});
