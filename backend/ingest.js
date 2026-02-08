import { parse as parseCsv } from "csv-parse/sync";

function looksLikeJson(text) {
  const t = text.trim();
  return t.startsWith("{") || t.startsWith("[");
}

export function parseUpload(buffer) {
  const text = buffer.toString("utf8").trim();
  if (!text) throw new Error("Empty upload");
  if (looksLikeJson(text)) return parseJson(text);
  return parseCsvTrades(text);
}

// -------- JSON path (your example format)
function parseJson(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON upload");
  }

  // Supports: { "transactions": [ ... ] } OR just [ ... ]
  const txs = Array.isArray(obj) ? obj : obj.transactions;
  if (!Array.isArray(txs) || !txs.length) {
    throw new Error("JSON must contain an array 'transactions'");
  }

  const trades = txs.map((t, i) => {
    const cash = Number(t.cash_cad);
    const side = cash < 0 ? "BUY" : cash > 0 ? "SELL" : null;

    const ts = t.order_date ?? t.settlement_date;
    const asset = String(t.symbol ?? "").toUpperCase();

    const qty = t.quantity ?? null;
    const price = t.price_cad ?? null;

    // trade size: prefer abs(cash), fallback qty*price
    const notional =
      Number.isFinite(cash) && cash !== 0
        ? Math.abs(cash)
        : qty != null && price != null
          ? Math.abs(Number(qty) * Number(price))
          : null;

    if (!ts || !asset) {
      throw new Error("Each transaction must include order_date/settlement_date and symbol");
    }

    return {
      tradeId: String(i + 1),
      ts,
      side,
      asset,
      qty,
      notional,
      pl: null, // not provided in this format
      fees: null,
      sourceFormat: "transactions_json",
    };
  });

  return { trades, mode: "basic" };
}

// -------- CSV path (flexible headers; P/L optional)
function parseCsvTrades(csvText) {
  const rows = parseCsv(csvText, { columns: true, skip_empty_lines: true, trim: true });
  if (!rows.length) throw new Error("CSV had no rows");

  const norm = (k) => k.toLowerCase().replace(/[^a-z0-9]/g, "");
  const keys = Object.keys(rows[0]);
  const map = Object.fromEntries(keys.map((k) => [norm(k), k]));

  const pick = (...cands) => cands.map((c) => map[norm(c)]).find(Boolean) ?? null;

  const kTs = pick("timestamp", "time", "date", "order_date", "orderdate", "settlement_date");
  const kSide = pick("buy/sell", "side", "action", "type");
  const kAsset = pick("asset", "symbol", "ticker");
  const kPL = pick("p/l", "pl", "pnl", "profit", "profit_loss", "profitloss", "realizedpnl");
  const kQty = pick("qty", "quantity");
  const kNotional = pick("notional", "cash", "cash_cad", "amount");

  if (!kTs || !kAsset) throw new Error("CSV missing Timestamp and Asset/Symbol columns");

  const trades = rows.map((r, i) => {
    const notionalRaw = kNotional ? r[kNotional] : (r.Notional ?? r.NOTIONAL ?? null);
    const plRaw = kPL ? r[kPL] : (r["P/L"] ?? r["p/l"] ?? null);

    return {
      tradeId: String(r.TradeId ?? r.TRADE_ID ?? (i + 1)),
      ts: r[kTs],
      side: kSide ? String(r[kSide]).toUpperCase() : null,
      asset: String(r[kAsset]).toUpperCase(),
      qty: kQty ? r[kQty] : (r.Qty ?? r.QTY ?? null),
      notional: notionalRaw,
      pl: plRaw,
      fees: r.Fees ?? r.FEES ?? null,
      sourceFormat: "csv",
    };
  });

  const mode = kPL ? "full" : "basic";
  return { trades, mode };
}
