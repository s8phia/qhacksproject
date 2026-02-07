require('dotenv').config();
const { parseWealthsimpleCSV } = require("./portfolio_backend/src/parsers/wealthsimple");
const { transactionsToJson, writeJson } = require("./portfolio_backend/src/utils/json_export");
const cors = require("cors");
const express = require('express');
const { analyzeBias } = require('./services/gemini');
const multer = require("multer");
const path = require("path");
const app = express();
app.use(cors());
const PORT = process.env.PORT || 3001;
const fs = require("fs");

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Backend is running' });
});

app.post('/api/analyze', async (req, res) => {
  const { transactions, archetype } = req.body || {};

  if (!Array.isArray(transactions) || !archetype) {
    return res.status(400).json({
      error: 'Invalid payload. Provide transactions[] and archetype.',
    });
  }

  try {
    const result = await analyzeBias(transactions, archetype);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to analyze bias.',
      details: error?.message || 'Unknown error',
    });
  }
});


const RAW_DIR = path.join(
  __dirname,
  "portfolio_backend",
  "data",
  "raw"
);

if (!fs.existsSync(RAW_DIR)) {
  fs.mkdirSync(RAW_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, RAW_DIR);
  },
  filename: (req, file, cb) => {
    const safeName = Date.now() + "-" + path.basename(file.originalname);
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith(".csv")) {
      return cb(new Error("Only CSV files allowed"));
    }
    cb(null, true);
  }
});

app.post(
  "/api/uploads/wealthsimple",
  upload.single("file"),
  (req, res) => {

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    console.log("Uploaded file:", req.file.path);

    try {
      const csvPath = req.file.path;

      const txs = parseWealthsimpleCSV(csvPath);

      const obj = transactionsToJson(txs);

      // Optional: keep writing the file like before
      const outPath = path.join(
        __dirname,
        "portfolio_backend",
        "data",
        "out",
        "transactions.json"
      );

      writeJson(obj, outPath);

      res.json({
        ok: true,
        filename: req.file.filename,
        count: txs.length,
        data: obj
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: "Normalization failed",
        message: err.message
      });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});