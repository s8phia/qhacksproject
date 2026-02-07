const fs = require("fs");
const path = require("path");

function transactionsToJson(transactions) {
  return {
    transactions: transactions.map((t) => ({
      order_date: t.order_date.toISOString().split("T")[0],
      settlement_date: t.settlement_date.toISOString().split("T")[0],
      symbol: t.symbol,
      quantity: t.quantity,
      price_cad: t.price_cad,
      cash_cad: t.cash_cad
    }))
  };
}

function writeJson(obj, filePath) {
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf-8");
}

module.exports = { transactionsToJson, writeJson };
