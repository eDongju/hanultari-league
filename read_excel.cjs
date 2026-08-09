const xlsx = require('xlsx');
const workbook = xlsx.readFile('D:/00_AI_Agent/docs/기존값.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
console.log(JSON.stringify(xlsx.utils.sheet_to_json(sheet), null, 2));
