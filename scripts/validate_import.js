const xlsx = require('xlsx');
const moment = require('moment');
const path = require('path');

// Change this to your spreadsheet file path
const filePath = 'C:\\Users\\jamie\\Documents\\Code\\net-worth-tracker\\data\\2025-08-20.ods'; // or .ods

const workbook = xlsx.readFile(filePath);
let skippedRows = [];

for (const sheetName of workbook.SheetNames) {
  console.log(`Processing sheet: ${sheetName}`);
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

  console.log(`\tFound ${data.length - 1} rows in sheet: ${sheetName}`);

  if (data.length > 1) {
    const headers = data[0];
    if (!headers[0] || headers[0].toString().toLowerCase() !== 'account') continue;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const accountName = row[0];
      const dateCell = row[1];
      let balanceStr = row[2];
      if (typeof balanceStr === 'string') {
        balanceStr = balanceStr.replace(/[^0-9.-]/g, '');
      }
      const balance = parseFloat(balanceStr);
      const currency = row[3] || 'CAD';
      const ticker = row[4] || '';

      let reason = null;
      if (!accountName) reason = 'Missing accountName';
      else if (dateCell === undefined || dateCell === null || dateCell === '') reason = 'Missing dateCell';
      else if (isNaN(balance)) reason = 'Balance is not a number';

      let date = null;
      if (typeof dateCell === 'number') {
        date = moment('1899-12-30').add(dateCell, 'days').format('YYYY-MM-DD');
      } else if (typeof dateCell === 'string' && moment(dateCell, moment.ISO_8601, true).isValid()) {
        date = moment(dateCell).format('YYYY-MM-DD');
      } else if (moment(dateCell).isValid()) {
        date = moment(dateCell).format('YYYY-MM-DD');
      }
      if (!date) reason = reason ? reason + ', could not parse date' : 'Could not parse date';

      if (reason) {
        skippedRows.push({ row: i + 1, sheet: sheetName, accountName, dateCell, balance: row[2], currency, ticker, reason });
        console.log(`Row ${i + 1} skipped:`, { accountName, dateCell, balance, currency, ticker, reason });
      }// else {
        // If no reason, the row is valid
        //console.log(`Row ${i + 1} is valid:`, { accountName, dateCell, balance, currency, ticker });
      //}
    }
  }
}

if (skippedRows.length) {
  //console.log('Skipped rows:');
  //skippedRows.forEach(r => {
    //console.log(`Row ${r.row}: ${JSON.stringify(r)}\n`);
  //});
} else {
  console.log('All rows would be imported successfully.');
}