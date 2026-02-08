// gemini_coach.js
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseJsonFromText(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function isOverloadError(err) {
  const msg = String(err?.message || err);
  return msg.includes("503") || msg.toLowerCase().includes("overloaded");
}

export async function coachLikeInvestor(payload) {
  // Mock mode for demo reliability
  if (!apiKey || !genAI) {
    const target = payload?.investor?.displayName || payload?.investor?.investorId || "chosen investor";
    return {
      investor: target,
      alignmentScore: payload?.alignment?.score ?? null,
      summary: "Mock coaching output (GEMINI_API_KEY not set).",
      keyGaps: (payload?.alignment?.gaps || []).slice(0, 6),
      actionPlan: [
        {
          objective: "Reduce overtrading to match target trade frequency",
          steps: ["Set 2 trade windows/day", "Max 3 trades/window", "Log every impulse trade"],
          metric: "trades_per_day",
          targetThreshold: "<= 6",
        },
        {
          objective: "Increase consistency (more like target)",
          steps: ["Define 2 setups only", "No deviation without written reason", "Weekly rule review"],
          metric: "setup_adherence_rate",
          targetThreshold: ">= 80%",
        },
      ],
      guardrails: ["No trades for 30 minutes after a loss", "Hard cap trades/day until score improves"],
      next7Days: [{ day: 1, tasks: ["Create rule sheet", "Set trade windows", "Set max trades/day"] }],
    };
  }

  const prompt = [
    "You are a behavioral finance + trading performance coach.",
    "Given a user's behavior + a target investor profile, output a precise plan to move the user toward the target.",
    "",
    "Return ONLY valid JSON with EXACT keys:",
    '{ "investor": string, "alignmentScore": number, "summary": string, "keyGaps": array, "actionPlan": array, "guardrails": array, "next7Days": array }',
    "",
    "Each actionPlan item must include: objective, steps, metric, targetThreshold.",
    "",
    "Data payload:",
    JSON.stringify(payload),
  ].join("\n");

  // Put your preferred models first. Avoid relying on preview only.
  const modelFallbacks = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-3-flash-preview",
  ];

  let lastErr = null;

  for (const modelName of modelFallbacks) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const response = await model.generateContent(prompt);
        const text = response?.response?.text?.() ?? "";

        const parsed = parseJsonFromText(text);
        if (parsed && parsed.investor && typeof parsed.summary === "string") return parsed;

        // If model responded but not JSON, treat as failure and try next attempt/model
        lastErr = new Error(`Unparseable JSON from model ${modelName}`);
      } catch (err) {
        lastErr = err;

        // If overload, retry with backoff; otherwise break and move to next model
        if (isOverloadError(err)) {
          await sleep(350 * attempt);
          continue;
        }
        break;
      }
    }
  }

  return {
    investor: payload?.investor?.displayName || payload?.investor?.investorId || "unknown",
    alignmentScore: payload?.alignment?.score ?? null,
    summary: "Gemini failed after retries/fallbacks.",
    keyGaps: payload?.alignment?.gaps || [],
    actionPlan: [],
    guardrails: ["Try again; model overload or error."],
    next7Days: [],
    error: String(lastErr?.message || lastErr),
  };
}
