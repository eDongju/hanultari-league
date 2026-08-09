const xlsx = require('xlsx');
const fs = require('fs');

const workbook = xlsx.readFile('D:/00_AI_Agent/docs/20260808_OPT_F.xlsx');
const sheet = workbook.Sheets['시드및선수명단'];
const data = xlsx.utils.sheet_to_json(sheet, {header: 1});

function excelDateToJSDate(serial) {
  if (typeof serial === 'string' && serial.includes('-')) return new Date(serial);
  if (!serial || isNaN(serial)) return null;
  const utc_days  = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;                                        
  const date_info = new Date(utc_value * 1000);
  return date_info;
}

function calculateAge(birthdate) {
  if (!birthdate) return '-';
  const today = new Date();
  let age = today.getFullYear() - birthdate.getFullYear();
  const m = today.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthdate.getDate())) {
      age--;
  }
  return age;
}

const members = [];
for (let i = 1; i < data.length; i++) {
  const name = data[i][18];
  if (name && typeof name === 'string' && name.trim() !== '') {
    const rawBirthdate = data[i][19];
    const jsDate = excelDateToJSDate(rawBirthdate);
    let birthStr = '-';
    let age = '-';
    if (jsDate && !isNaN(jsDate.getTime())) {
      birthStr = jsDate.toISOString().slice(0, 10);
      age = calculateAge(jsDate);
    }
    
    // 점수 (score) : col 21 is a rating, col 17 is seed
    const rawScore = data[i][21]; 
    const displayScore = rawScore ? Number(rawScore).toFixed(2) : '-';

    members.push({
      id: `m_${i}`,
      name: name.trim(),
      score: displayScore,
      birthdate: birthStr,
      age: age,
      photoUrl: '' // placeholder
    });
  }
}

fs.writeFileSync('D:/00_AI_Agent/hanultari-web/src/members.json', JSON.stringify(members, null, 2));
console.log(`Extracted ${members.length} members with details.`);
