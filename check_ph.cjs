const fs = require('fs');
const data = JSON.parse(fs.readFileSync('all_sessions.json', 'utf8'));

const points = data.documents
  .filter(d => d.fields.pointHistory && d.fields.pointHistory.arrayValue && d.fields.pointHistory.arrayValue.values)
  .map(d => d.fields.pointHistory.arrayValue.values)
  .flat()
  .slice(0, 5);

console.log(JSON.stringify(points, null, 2));
