const path = require("path");
const { parseWealthsimpleCSV } = require("./parsers/wealthsimple");
const { transactionsToJson, writeJson } = require("./utils/json_export");

function main() {
  if (process.argv.length < 3) {
    console.log("Usage: node src/main.js <csv_filename>");
    process.exit(1);
  }

  const csvFilename = process.argv[2];

  const baseDir = path.resolve(__dirname, "..");

  const inputCsv = path.join(baseDir, "data", "raw", csvFilename);
  const outputJson = path.join(baseDir, "data", "out", "transactions.json");

  const txs = parseWealthsimpleCSV(inputCsv);

  const obj = transactionsToJson(txs);
  writeJson(obj, outputJson);

  console.log(`Wrote ${txs.length} transactions`);
}

if (require.main === module) {
  main();
}

module.exports = { main };
