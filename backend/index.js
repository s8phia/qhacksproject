import express from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import cors from "cors";

import { getConnection } from "./snowflake.js";
import { exec } from "./exec.js";

import { parseUpload } from "./ingest.js";
import { fetchTrades, computeBiases, coachingFromBiases, chartData } from "./bias.js";
import { computeUserMetrics, normalizeMetrics } from "./metrics.js";
import {
  getInvestorVector,
  computeUserVector,
  computeUserVectorFromPortfolioMetrics,
  alignmentScore,
} from "./alignment.js";

import { coachLikeInvestor } from "./gemini_coach.js";

const require = createRequire(import.meta.url);
const { runPythonMetrics } = require("./services/metrics.cjs");
const { analyzeBias } = require("./services/gemini.cjs");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const RAW_DIR = path.join(__dirname, "uploads", "usertrades_raw");
if (!fs.existsSync(RAW_DIR)) {
  fs.mkdirSync(RAW_DIR, { recursive: true });
}

const sessionPortfolioMetrics = new Map();
const sessionTrades = new Map(); // in-memory fallback when Snowflake is unavailable
let lastUserTradesResult = null;

function normalizeTrades(trades) {
  return trades
    .map((t) => {
      const ts = new Date(t.ts);
      if (Number.isNaN(ts.valueOf())) return null;
      return {
        ...t,
        ts,
        side: t.side ? String(t.side).toUpperCase() : null,
        asset: t.asset ? String(t.asset).toUpperCase() : null,
        qty: t.qty == null || t.qty === "" ? null : Number(t.qty),
        notional: t.notional == null || t.notional === "" ? null : Number(t.notional),
        pl: t.pl == null || t.pl === "" ? null : Number(t.pl),
      };
    })
    .filter(Boolean);
}

async function getTradesForSession(sessionId) {
  let trades = [];
  let conn = null;

  try {
    conn = await getConnection();
    trades = await fetchTrades(conn, sessionId);
  } catch (err) {
    console.warn("Snowflake fetch failed; using fallback if available:", err?.message || err);
  } finally {
    if (conn) conn.destroy();
  }

  if ((!trades || trades.length === 0) && sessionTrades.has(sessionId)) {
    trades = sessionTrades.get(sessionId);
  }

  return trades;
}

function csvCell(value) {
  if (value === null || value === undefined || value === "") return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildNormalizedTradesCsv(trades) {
  const header = "timestamp,side,asset,quantity,entry_price,profit_loss";
  const rows = trades.map((t) => {
    const tsValue = t.ts instanceof Date ? t.ts.toISOString() : t.ts;
    const qty = t.qty == null || t.qty === "" ? null : Number(t.qty);
    const notional = t.notional == null || t.notional === "" ? null : Number(t.notional);
    const entryPrice = Number.isFinite(qty) && qty !== 0 && Number.isFinite(notional)
      ? Math.abs(notional) / Math.abs(qty)
      : null;

    return [
      tsValue,
      t.side,
      t.asset,
      qty,
      entryPrice,
      t.pl,
    ].map(csvCell).join(",");
  });

  return [header, ...rows].join("\n");
}

async function computePortfolioMetricsForSession(sessionId, trades) {
  if (sessionPortfolioMetrics.has(sessionId)) {
    return sessionPortfolioMetrics.get(sessionId);
  }
  if (!trades || !trades.length) return null;

  const normalizedCsv = buildNormalizedTradesCsv(trades);
  const csvPath = path.join(RAW_DIR, `${sessionId}-normalized.csv`);
  await fs.promises.writeFile(csvPath, normalizedCsv);

  const pyResult = await runPythonMetrics(csvPath);
  const portfolioMetrics = pyResult?.portfolio_metrics || null;
  if (portfolioMetrics) {
    sessionPortfolioMetrics.set(sessionId, portfolioMetrics);
  }
  return portfolioMetrics;
}

app.get("/", (req, res) => {
  res.json({ message: "Backend is running" });
});

app.post("/api/analyze", async (req, res) => {
  const metrics = req.body?.metrics || lastUserTradesResult?.metrics;

  if (!metrics) {
    return res.status(400).json({
      error: "Invalid payload. Provide metrics or upload a CSV first.",
    });
  }

  try {
    const result = await analyzeBias(metrics);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to analyze bias.",
      details: error?.message || "Unknown error",
    });
  }
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

app.post("/api/uploads/usertrades", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const original = req.file.originalname || "upload.csv";
  if (!original.toLowerCase().endsWith(".csv")) {
    return res.status(400).json({ error: "Only CSV files allowed" });
  }

  try {
    const safeName = `${Date.now()}-${path.basename(original)}`;
    const rawPath = path.join(RAW_DIR, safeName);
    await fs.promises.writeFile(rawPath, req.file.buffer);

    // Create session ID for this upload
    const sessionId = uuidv4();
    const userId = "demo-user";

    let metrics = null;

    // Parse trades, normalize, and run metrics (critical path)
    let normalized = [];
    try {
      const { trades } = parseUpload(req.file.buffer);
      normalized = normalizeTrades(trades);
      if (normalized.length) {
        sessionTrades.set(sessionId, normalized);
      }

      // Normalize CSV for Python metrics
      const normalizedCsv = buildNormalizedTradesCsv(normalized);
      const normalizedPath = path.join(RAW_DIR, `${sessionId}-normalized.csv`);
      await fs.promises.writeFile(normalizedPath, normalizedCsv);
      metrics = await runPythonMetrics(normalizedPath);
    } catch (err) {
      console.error("Upload parsing/metrics failed:", err);
      return res.status(400).json({ error: "Normalization failed", message: err?.message || String(err) });
    }

    // Try to persist to Snowflake (non-blocking for response)
    try {
      const parsedDates = normalized
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

      // Insert session
      await exec(
        conn,
        `INSERT INTO CORE.SESSIONS (SESSION_ID, USER_ID, SOURCE, NUM_TRADES, DATE_START, DATE_END)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [sessionId, userId, "simple_upload", normalized.length, dateStart, dateEnd]
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
      
      // Store portfolio metrics for this session
      if (metrics?.portfolio_metrics) {
        sessionPortfolioMetrics.set(sessionId, metrics.portfolio_metrics);
      }
    } catch (err) {
      console.warn("Failed to create session for simple upload:", err?.message || err);
    }

    lastUserTradesResult = {
      ok: true,
      filename: safeName,
      sessionId,
      metrics,
    };

    return res.json(lastUserTradesResult);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Normalization failed",
      message: err.message,
    });
  }
});

app.get("/api/uploads/usertrades", (req, res) => {
  if (!lastUserTradesResult) {
    return res.status(404).json({
      error: "No user trades have been uploaded yet",
    });
  }

  return res.json(lastUserTradesResult);
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
    const normalized = normalizeTrades(trades);
    if (normalized.length) {
      sessionTrades.set(sessionId, normalized);
    }

    // Compute portfolio metrics via bias_engine.py for this upload
    let portfolioMetrics = null;
    try {
      const rawName = `${sessionId}-${path.basename(req.file.originalname || "upload.csv")}`;
      const rawPath = path.join(RAW_DIR, rawName);
      await fs.promises.writeFile(rawPath, req.file.buffer);

      const normalizedCsv = buildNormalizedTradesCsv(normalized);
      const normalizedPath = path.join(RAW_DIR, `${sessionId}-normalized.csv`);
      await fs.promises.writeFile(normalizedPath, normalizedCsv);

      const pyResult = await runPythonMetrics(normalizedPath);
      portfolioMetrics = pyResult?.portfolio_metrics || null;
      if (portfolioMetrics) {
        sessionPortfolioMetrics.set(sessionId, portfolioMetrics);
      }
    } catch (err) {
      console.warn("Failed to compute portfolio metrics from upload:", err?.message || err);
    }

    if (!portfolioMetrics) {
      try {
        portfolioMetrics = await computePortfolioMetricsForSession(sessionId, trades);
      } catch (err) {
        console.warn("Failed to compute portfolio metrics from normalized trades:", err?.message || err);
      }
    }

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
      portfolioMetrics,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/analyze/:sessionId", async (req, res) => {
  const { sessionId } = req.params;

  try {
    const trades = await getTradesForSession(sessionId);
    if (!trades || trades.length === 0) {
      return res.status(404).json({ ok: false, error: "No trades found for this session" });
    }

    const biases = computeBiases(trades);

    // metrics per your diagram
    const userMetrics = computeUserMetrics(trades);
    const normalizedMetrics = normalizeMetrics(userMetrics);

    // charts for UI
    const charts = chartData(trades);

    // store bias metrics (scores + raw JSON) if Snowflake is reachable
    try {
      const conn = await getConnection();
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
    } catch (err) {
      console.warn("Skipping Snowflake bias upsert:", err?.message || err);
    }

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

app.get("/compare/:sessionId/:investorId", async (req, res) => {
  const { sessionId, investorId } = req.params;

  try {
    const conn = await getConnection();

    const trades = await getTradesForSession(sessionId);
    if (!trades || trades.length === 0) {
      return res.status(404).json({ ok: false, error: "No trades found for this session" });
    }
    const biases = computeBiases(trades);

    const investorVecRaw = await getInvestorVector(conn, investorId);
    const investorVector = typeof investorVecRaw === "string" ? JSON.parse(investorVecRaw) : investorVecRaw;

    let portfolioMetrics = sessionPortfolioMetrics.get(sessionId) || null;
    if (!portfolioMetrics) {
      try {
        portfolioMetrics = await computePortfolioMetricsForSession(sessionId, trades);
      } catch (err) {
        console.warn("Failed to compute portfolio metrics for compare:", err?.message || err);
      }
    }
    const userVector =
      computeUserVectorFromPortfolioMetrics(portfolioMetrics) || computeUserVector(trades, biases);
    const alignment = alignmentScore(userVector, investorVector);

    conn.destroy();

    res.json({
      ok: true,
      sessionId,
      investorId,
      alignment,
      userVector,
      investorVector,
      portfolioMetrics,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * NEW:
 * GET /coach/:sessionId/:investorId
 *
 * Computes comparison for chosen investor, then sends payload to Gemini
 * so Gemini returns "how to be more like X investor".
 */
app.get("/coach/:sessionId/:investorId", async (req, res) => {
  const { sessionId, investorId } = req.params;
  const includeHoldings = String(req.query.holdings || "0") === "1";

  try {
    const conn = await getConnection();

    // --- user side ---
    const trades = await getTradesForSession(sessionId);
    if (!trades || trades.length === 0) {
      return res.status(404).json({ ok: false, error: "No trades found for this session" });
    }
    const biases = computeBiases(trades);
    const userMetrics = computeUserMetrics(trades);
    const normalizedMetrics = normalizeMetrics(userMetrics);

    let portfolioMetrics = sessionPortfolioMetrics.get(sessionId) || null;
    if (!portfolioMetrics) {
      try {
        portfolioMetrics = await computePortfolioMetricsForSession(sessionId, trades);
      } catch (err) {
        console.warn("Failed to compute portfolio metrics for coach:", err?.message || err);
      }
    }
    const userVector =
      computeUserVectorFromPortfolioMetrics(portfolioMetrics) || computeUserVector(trades, biases);

    // --- investor side ---
    const invRows = await exec(conn, `SELECT * FROM CORE.INVESTORS WHERE INVESTOR_ID = ? LIMIT 1`, [investorId]);
    const investorMeta = invRows?.[0] || { INVESTOR_ID: investorId };

    const investorVecRaw = await getInvestorVector(conn, investorId);
    const investorVector = typeof investorVecRaw === "string" ? JSON.parse(investorVecRaw) : investorVecRaw;

    const alignment = alignmentScore(userVector, investorVector);

    // optional: pull latest quarter metrics as extra context (cheap)
    const qRows = await exec(
      conn,
      `SELECT REPORT_PERIOD, HOLDINGS_COUNT, TOTAL_VALUE_USD_THOUSANDS,
              TOP10_CONCENTRATION, TURNOVER_PROXY, CONSISTENCY_PROXY
       FROM TRADE_SHIELD.ANALYTICS.INVESTOR_QUARTER_METRICS
       WHERE INVESTOR_ID = ?
       ORDER BY REPORT_PERIOD DESC
       LIMIT 1`,
      [investorId]
    );
    const latestQuarter = qRows?.[0] || null;

    // optional: pull top holdings (more tokens, so off by default)
    let holdings = null;
    if (includeHoldings) {
      const rpRows = await exec(
        conn,
        `SELECT MAX(REPORT_PERIOD) AS RP
         FROM TRADE_SHIELD.ANALYTICS.INVESTOR_13F_HOLDINGS
         WHERE INVESTOR_ID = ?`,
        [investorId]
      );
      const rp = rpRows?.[0]?.RP ? String(rpRows[0].RP).slice(0, 10) : null;

      if (rp) {
        holdings = await exec(
          conn,
          `SELECT ISSUER, TITLE_OF_CLASS, CUSIP, VALUE_USD_THOUSANDS, SHARES
           FROM TRADE_SHIELD.ANALYTICS.INVESTOR_13F_HOLDINGS
           WHERE INVESTOR_ID = ? AND REPORT_PERIOD = ?
           ORDER BY VALUE_USD_THOUSANDS DESC
           LIMIT 15`,
          [investorId, rp]
        );
      } else {
        holdings = [];
      }
    }

    // --- payload to Gemini ---
    const payload = {
      sessionId,
      investor: {
        investorId: investorMeta.INVESTOR_ID || investorId,
        displayName: investorMeta.DISPLAY_NAME || investorMeta.DISPLAY || null,
        category: investorMeta.CATEGORY || null,
        source: investorMeta.SOURCE || null,
      },
      user: {
        userVector,
        userMetrics,
        normalizedMetrics,
        biases, // includes evidence & scores already
        portfolioMetrics,
      },
      target: {
        investorVector,
        latestQuarter,
        holdings,
      },
      alignment, // score + gaps
      constraints: {
        focusTraits: ["trade_frequency", "holding_patience", "risk_reactivity", "consistency"],
        goal: "Make the user trade more like the target investor, by reducing mismatches in the vector while addressing detected biases.",
      },
    };

    const coaching = await coachLikeInvestor(payload);

    conn.destroy();

    res.json({
      ok: true,
      sessionId,
      investorId,
      comparison: {
        investor: payload.investor,
        alignment,
        userVector,
        investorVector,
      },
      coaching,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
