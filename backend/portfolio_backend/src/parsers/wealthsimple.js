const fs = require("fs");
const { parse } = require("csv-parse/sync");
const Transaction = require("../models/transaction");

function parseWealthsimpleCSV(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");

    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true
    });

    const transactions = [];

    for (const row of records) {

      if (!row.symbol || !row.symbol.trim()) continue;

      const t = new Transaction(
        parseDate(row.transaction_date),
        parseDate(row.settlement_date),
        row.symbol.trim(),
        parseFloat(row.quantity),
        parseFloat(row.unit_price),
        parseFloat(row.net_cash_amount)
      );

      transactions.push(t);
    }

    return transactions;

  } catch (err) {
    throw new Error("Failed to parse Wealthsimple CSV: " + err.message);
  }
}

function parseDate(s) {
  if (!s) return null;
  return new Date(s + "T00:00:00Z");
}

module.exports = { parseWealthsimpleCSV, parseDate };
