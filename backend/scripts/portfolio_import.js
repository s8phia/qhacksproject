const path = require("path");
const { parseWealthsimpleCSV } = require("../services/portfolio_import/parsers/wealthsimple");
const { transactionsToJson, writeJson } = require("../services/portfolio_import/utils/json_export");

function main() {
  if (process.argv.length < 3) {
    console.log("Usage: node scripts/portfolio_import.js <csv_filename>");
    process.exit(1);
  }

  const csvFilename = process.argv[2];

  const baseDir = path.resolve(__dirname, "..");

  const inputCsv = path.join(baseDir, "data", "portfolio_import", "raw", csvFilename);
  const outputJson = path.join(baseDir, "data", "portfolio_import", "out", "transactions.json");

  const txs = parseWealthsimpleCSV(inputCsv);

  const obj = transactionsToJson(txs);
  writeJson(obj, outputJson);

  console.log(`Wrote ${txs.length} transactions`);
}

if (require.main === module) {
  main();
}

module.exports = { main };
