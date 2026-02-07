const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

function parseJsonFromText(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}


async function analyzeBias(transactions, archetype) {
  if (!Array.isArray(transactions)) {
    return {
      biases: [],
      overallSeverity: "None",
      tips: ["Invalid transactions input."],
    };
  }

  if (!apiKey) {
    return {
      biases: [
        "Overtrading: mock result",
        "Loss Aversion: mock result",
        "Revenge Trading: mock result"
      ],
      overallSeverity: "low",
      tips: ["Enable GEMINI_API_KEY for live analysis."]
    };
  }

  const prompt = [
    "You are a trading bias analyst.",
    "Identify these biases if evidence exists: Overtrading, Loss Aversion, Revenge Trading.",
    "Return ONLY valid JSON with keys: biases (array of strings), overallSeverity (string), tips (array of strings).",
    `Archetype: ${archetype}`,
    `Transactions: ${JSON.stringify(transactions)}`,
  ].join("\n");

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
    const response = await model.generateContent(prompt);
    const text = response?.response?.text?.() ?? "";
    const parsed = parseJsonFromText(text);

    if (parsed && parsed.biases && parsed.overallSeverity && parsed.tips) {
      return parsed;
    }

    return {
      biases: ["unparseable-response"],
      overallSeverity: "unknown",
      tips: ["Gemini response was not valid JSON."]
    };
  } catch (err) {
    console.error("Error calling Gemini:", err);
    return {
      biases: ["error-calling-api"],
      overallSeverity: "unknown",
      tips: ["Check GEMINI_API_KEY and network connection."]
    };
  }
}

module.exports = { analyzeBias };
