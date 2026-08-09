const xlsx = require('xlsx');
const workbook = xlsx.readFile('../docs/20260808_OPT_F.xlsx');
const sheet = workbook.Sheets['AA대진순서'];
const range = xlsx.utils.decode_range(sheet['!ref']);
const data = [];
for(let r = 0; r < 20; ++r) {
    const row = [];
    for(let c = 0; c < 20; ++c) {
        const cell = sheet[xlsx.utils.encode_cell({c, r})];
        row.push(cell ? cell.v : null);
    }
    data.push(row);
}
console.log(JSON.stringify(data, null, 2));
