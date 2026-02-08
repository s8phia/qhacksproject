import express from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import "dotenv/config";

import { getConnection } from "./snowflake.js";
import { exec } from "./exec.js";

import { parseUpload } from "./ingest.js";
import { fetchTrades, computeBiases, coachingFromBiases, chartData } from "./bias.js";
import { computeUserMetrics, normalizeMetrics } from "./metrics.js";
import { getInvestorVector, computeUserVector, alignmentScore } from "./alignment.js";

const app = express();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } 
});

app.get("/health", async (req, res) => {
  try {
    const conn = await getConnection();
    const rows = await exec(conn, "SELECT CURRENT_VERSION() AS VERSION");
    conn.destroy();
    res.json({ ok: true, snowflakeVersion: rows[0].VERSION });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/investors/:investorId/metrics", async (req, res) => {
  const { investorId } = req.params;

  try {
    const conn = await getConnection({ database: "TRADE_SHIELD", schema: "CORE" });

    const rows = await exec(
      conn,
      `SELECT REPORT_PERIOD, HOLDINGS_COUNT, TOTAL_VALUE_USD_THOUSANDS,
              TOP10_CONCENTRATION, TURNOVER_PROXY, CONSISTENCY_PROXY,
              VECTOR_JSON
       FROM TRADE_SHIELD.ANALYTICS.INVESTOR_QUARTER_METRICS
       WHERE INVESTOR_ID = ?
       ORDER BY REPORT_PERIOD DESC
       LIMIT 12`,
      [investorId]
    );

    res.json({ ok: true, investorId, quarters: rows });
    conn.destroy();
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.get("/investors/:investorId/holdings/latest", async (req, res) => {
  const { investorId } = req.params;
  const limit = Number(req.query.limit || 20);

  try {
    const conn = await getConnection({ database: "TRADE_SHIELD", schema: "CORE" });

    const rpRows = await exec(
      conn,
      `SELECT MAX(REPORT_PERIOD) AS RP
       FROM TRADE_SHIELD.ANALYTICS.INVESTOR_13F_HOLDINGS
       WHERE INVESTOR_ID = ?`,
      [investorId]
    );
    const rp = rpRows?.[0]?.RP ? String(rpRows[0].RP).slice(0, 10) : null;
    if (!rp) return res.status(404).json({ ok: false, error: "No holdings found" });

    const rows = await exec(
      conn,
      `SELECT ISSUER, TITLE_OF_CLASS, CUSIP, VALUE_USD_THOUSANDS, SHARES
       FROM TRADE_SHIELD.ANALYTICS.INVESTOR_13F_HOLDINGS
       WHERE INVESTOR_ID = ? AND REPORT_PERIOD = ?
       ORDER BY VALUE_USD_THOUSANDS DESC
       LIMIT ${Math.min(limit, 100)}`,
      [investorId, rp]
    );

    res.json({ ok: true, investorId, reportPeriod: rp, holdings: rows });
    conn.destroy();
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * POST /upload
 * form-data:
 *  - file: CSV or JSON file
 *  - userId: optional string
 */
app.post("/upload", upload.single("file"), async (req, res) => {
  const userId = (req.body.userId || "demo-user").toString();

  try {
    if (!req.file) return res.status(400).json({ ok: false, error: "Missing file field 'file'" });

    const { trades, mode } = parseUpload(req.file.buffer);

    const sessionId = uuidv4();

    // Session date range
    const parsedDates = trades
      .map((t) => new Date(t.ts))
      .filter((d) => !Number.isNaN(d.valueOf()))
      .sort((a, b) => a - b);

    const dateStart = parsedDates.length ? parsedDates[0].toISOString().slice(0, 10) : null;
    const dateEnd = parsedDates.length ? parsedDates[parsedDates.length - 1].toISOString().slice(0, 10) : null;

    const conn = await getConnection();

    // Ensure user exists
    await exec(
      conn,
      `MERGE INTO CORE.USERS t
       USING (SELECT ? AS USER_ID) s
       ON t.USER_ID = s.USER_ID
       WHEN NOT MATCHED THEN INSERT (USER_ID) VALUES (s.USER_ID)`,
      [userId]
    );

    // Insert session (store mode in SOURCE for now)
    await exec(
      conn,
      `INSERT INTO CORE.SESSIONS (SESSION_ID, USER_ID, SOURCE, NUM_TRADES, DATE_START, DATE_END)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sessionId, userId, `upload_${mode}`, trades.length, dateStart, dateEnd]
    );

    // Batch insert trades
    const values = trades.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    const binds = trades.flatMap((t) => [
      sessionId,
      String(t.tradeId),
      t.ts,
      t.side,
      t.asset,
      t.qty == null || t.qty === "" ? null : t.qty,
      t.notional == null || t.notional === "" ? null : t.notional,
      t.pl == null || t.pl === "" ? null : t.pl,
    ]);

    await exec(
      conn,
      `INSERT INTO CORE.TRADES (SESSION_ID, TRADE_ID, TS, SIDE, ASSET, QTY, NOTIONAL, PL)
       SELECT * FROM VALUES ${values}`,
      binds
    );

    conn.destroy();

    res.json({
      ok: true,
      sessionId,
      tradesInserted: trades.length,
      dateStart,
      dateEnd,
      mode,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/analyze/:sessionId", async (req, res) => {
  const { sessionId } = req.params;

  try {
    const conn = await getConnection();

    const trades = await fetchTrades(conn, sessionId);
    const biases = computeBiases(trades);

    // metrics per your diagram
    const userMetrics = computeUserMetrics(trades);
    const normalizedMetrics = normalizeMetrics(userMetrics);

    // charts for UI
    const charts = chartData(trades);

    // store bias metrics (scores + raw JSON)
    await exec(
      conn,
      `MERGE INTO ANALYTICS.USER_BIAS_METRICS t
       USING (SELECT ? AS SESSION_ID) s
       ON t.SESSION_ID = s.SESSION_ID
       WHEN MATCHED THEN UPDATE SET
         OVERTRADING_SCORE = ?,
         REVENGE_SCORE = ?,
         LOSS_AVERSION_SCORE = ?,
         BIAS_SUMMARY_JSON = ?,
         COMPUTED_AT = CURRENT_TIMESTAMP()
       WHEN NOT MATCHED THEN INSERT
         (SESSION_ID, OVERTRADING_SCORE, REVENGE_SCORE, LOSS_AVERSION_SCORE, BIAS_SUMMARY_JSON)
         VALUES (?, ?, ?, ?, ?)`,
      [
        sessionId,
        biases.overtrading.score,
        biases.revenge.score,
        biases.lossAversion.score,
        JSON.stringify(biases),
        sessionId,
        biases.overtrading.score,
        biases.revenge.score,
        biases.lossAversion.score,
        JSON.stringify(biases),
      ]
    );

    conn.destroy();

    const mode =
      trades.filter((t) => t.pl != null && t.pl !== "").length >= Math.max(2, Math.floor(trades.length * 0.3))
        ? "full"
        : "basic";

    res.json({
      ok: true,
      sessionId,
      mode,
      tradeCount: trades.length,
      biases,
      coaching: coachingFromBiases(biases),
      userMetrics,
      normalizedMetrics,
      charts,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/investors", async (req, res) => {
  try {
    const conn = await getConnection();
    const rows = await exec(conn, "SELECT * FROM CORE.INVESTORS ORDER BY DISPLAY_NAME");
    conn.destroy();
    res.json({ ok: true, investors: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/compare/:sessionId/:investorId", async (req, res) => {
  const { sessionId, investorId } = req.params;

  try {
    const conn = await getConnection();

    const trades = await fetchTrades(conn, sessionId);
    const biases = computeBiases(trades);

    const investorVec = await getInvestorVector(conn, investorId);
    const userVec = computeUserVector(trades, biases);
    const alignment = alignmentScore(userVec, investorVec);

    conn.destroy();

    res.json({
      ok: true,
      sessionId,
      investorId,
      alignment,
      userVector: userVec,
      investorVector: typeof investorVec === "string" ? JSON.parse(investorVec) : investorVec,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
