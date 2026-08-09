const xlsx = require('xlsx');
const workbook = xlsx.readFile('../20260808_OPT_F.xlsx');
const sheet = workbook.Sheets['AA대진순서'];
const range = xlsx.utils.decode_range(sheet['!ref']);
// Row 18 is index 17
const rowData = [];
for(let C = range.s.c; C <= range.e.c; ++C) {
    const cellAddress = {c:C, r:17};
    const cellRef = xlsx.utils.encode_cell(cellAddress);
    const cell = sheet[cellRef];
    rowData.push(cell ? cell.v : null);
}
console.log(JSON.stringify(rowData));
