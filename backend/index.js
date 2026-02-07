require('dotenv').config();
const express = require('express');
const { analyzeBias } = require('./services/gemini');
const app = express();
const PORT = process.env.PORT || 3001;

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


