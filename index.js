const fs = require('fs');
const pdf = require('pdf-parse');
const path = require('path');

// === CONFIG ===
const inputPdfPath = './test_data.pdf'; // update with your file path
const outputJsonPath = './nitori_schedule.json';
const targetNames = ['AZAN', 'AIMAN', 'HANI', 'IRFAN'];
const fixedDates = Array.from({ length: 36 }, (_, i) => 26 + i);

// Manual shift code splitter
function splitShiftBlock(block) {
  const shifts = [];
  let i = 0;
  while (i < block.length && shifts.length < 36) {
    const slice = block.slice(i);

    if (/^(off|AL|TR|TP|MC|TBD)/i.test(slice)) {
      shifts.push(slice.match(/^(off|AL|TR|TP|MC|TBD)/i)[0]);
      i += shifts[shifts.length - 1].length;
    } else if (/^\d{2}[A-D]\d/.test(slice)) {
      shifts.push(slice.slice(0, 4));
      i += 4;
    } else if (/^\d{2}/.test(slice)) {
      shifts.push(slice.slice(0, 2));
      i += 2;
    } else {
      // Fail-safe fallback to skip 1 char
      i += 1;
    }
  }
  return shifts;
}

// === MAIN PARSER ===
async function main() {
  try {
    const pdfBuffer = fs.readFileSync(inputPdfPath);
    const data = await pdf(pdfBuffer);
    const lines = data.text.split('\n').map(l => l.trim()).filter(Boolean);

    const result = {};

    for (let i = 0; i < lines.length - 1; i++) {
      const line1 = lines[i];
      const line2 = lines[i + 1];

      const upperLine = line1.toUpperCase();
      const name = targetNames.find(n => upperLine.includes(n));
      if (!name) continue;

      // Preprocess line to fix format and glue
      const combined = `${line1} ${line2}`
        .replace(/([A-Z]{2,})(MALE|FEMALE)/g, '$1 $2')
        .replace(/(MALE|FEMALE)(\d{8})/, '$1 $2')
        .replace(/(\d{6})([A-Z]+)/, '$1 $2');

      const parts = combined.split(/\s+/);
      const nameIdx = parts.findIndex(p => p === name);
      if (nameIdx === -1) continue;

      const header = parts.slice(0, nameIdx + 1).join(' ');
      const shiftBlock = parts.slice(nameIdx + 1).join('');

      const shiftCodes = splitShiftBlock(shiftBlock);

      if (shiftCodes.length < 36) {
        console.warn(`⚠️ Skipping ${name}: only ${shiftCodes.length} shifts parsed`);
        continue;
      }

      const shifts = {};
      for (let j = 0; j < 36; j++) {
        shifts[fixedDates[j]] = shiftCodes[j];
      }

      result[name] = { header, shifts };
    }

    if (Object.keys(result).length === 0) {
      console.warn('⚠️ Still no matching staff data found.');
    } else {
      fs.writeFileSync(outputJsonPath, JSON.stringify(result, null, 2), 'utf8');
      console.log(`✅ Saved JSON to ${path.resolve(outputJsonPath)}`);
    }
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

main();
