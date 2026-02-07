require('dotenv').config();
const { runPythonMetrics } = require("./services/metrics");
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
  "services",
  "portfolio_import",
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
  async (req, res) => {

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    try {
      const csvPath = req.file.path;
      const metrics = await runPythonMetrics(csvPath);

      res.json({
        ok: true,
        filename: req.file.filename,
        metrics
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