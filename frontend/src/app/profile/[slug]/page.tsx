"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PortfolioRadar from "@/app/components/RadarChart";
import BiasPieChart from "@/app/components/BiasPieChart";
import CountUp from "@/app/components/CountUp";
import PortfolioTimeline from "@/app/components/PortfolioTimeline";

type ProfileData = {
  name: string;
  avatarUrl?: string;
  bio?: string;
  tradingStyle?: string;
  riskProfile?: string;
  stats?: Record<string, string | number>;
};

const PERSONAS = [
  { label: "Warren Buffett", slug: "warren-buffett", investorId: "buffett_berkshire" },
  { label: "Cathie Wood", slug: "cathie-wood", investorId: "cathie_ark" },
  { label: "Michael Burry", slug: "michael-burry", investorId: "burry_scion" }
];

function getPersonaImage(slug: string) {
  const map: Record<string, string> = {
    "warren-buffett": "/profile1.jpg",
    "cathie-wood": "/profile2.jpg",
    "michael-burry": "/profile3.jpg"
  };

  return map[slug] ?? "/profile1.jpg";
}

const HARDCODED_PERSONA_RADAR: Record<string, any> = {
  "warren-buffett": {
    normalizedMetrics: {
      trade_frequency: 0.1,
      avg_trade_size: 0.85,
      holding_period: 0.95,
      after_loss: 0.2,
      size_variability: 0.25
    }
  },
  "cathie-wood": {
    normalizedMetrics: {
      trade_frequency: 0.75,
      avg_trade_size: 0.6,
      holding_period: 0.5,
      after_loss: 0.7,
      size_variability: 0.75
    }
  },
  "michael-burry": {
    normalizedMetrics: {
      trade_frequency: 0.35,
      avg_trade_size: 0.8,
      holding_period: 0.7,
      after_loss: 0.55,
      size_variability: 0.45
    }
  }
};

export default function ProfilePage() {
    const params = useParams();
    const slug = params.slug as string;
    const router = useRouter();

    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);

    const [personaResult, setPersonaResult] = useState<any>(null);

    // 🔽 this comes from your backend now
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [biasRatios, setBiasRatios] = useState<Record<string, number> | null>(null);
    const [geminiAnalysis, setGeminiAnalysis] = useState<{ summary?: string; suggestions?: string[] } | null>(null);
    const [geminiError, setGeminiError] = useState<string | null>(null);
    const [coachingData, setCoachingData] = useState<any>(null);
    const [coachingLoading, setCoachingLoading] = useState(false);
    const [coachingError, setCoachingError] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);

    // 🔽 only for dumping / debugging
    const [rawApiData, setRawApiData] = useState<any>(null);

    useEffect(() => {
        if (!slug) return;

        setLoading(true);

        setProfile({
        name: slug.replace(/-/g, " ")
        });

        setPersonaResult(HARDCODED_PERSONA_RADAR[slug]);

        const load = async () => {
          try {
            // pull latest uploaded metrics
            const res = await fetch("http://localhost:3001/api/uploads/usertrades");
            if (!res.ok) {
              throw new Error("No uploaded data yet");
            }
            const data = await res.json();
            setRawApiData(data);
            const uploadSessionId = data.sessionId || (typeof window !== 'undefined' ? localStorage.getItem('sessionId') : null);
            if (uploadSessionId) {
              setSessionId(uploadSessionId);
              if (typeof window !== 'undefined') {
                localStorage.setItem('sessionId', uploadSessionId);
              }
            }

            const pm = data.metrics?.portfolio_metrics;
            const biasTypeRatios = data.metrics?.bias_type_ratios ?? null;

            if (!pm) {
              setAnalysisResult(null);
              setBiasRatios(biasTypeRatios);
            } else {
              const radarData = {
                normalizedMetrics: {
                  trade_frequency: pm.trade_frequency_score / 100,
                  holding_period: pm.holding_patience_score / 100,
                  after_loss: pm.risk_reactivity_score / 100,

                  // you do not currently have real backend values for these two
                  // so we map something reasonable for now
                  avg_trade_size: pm.consistency_score / 100,
                  size_variability: pm.consistency_score / 100
                }
              };

              setAnalysisResult(radarData);
              setBiasRatios(biasTypeRatios);
            }

            // Show page immediately, don't wait for Gemini
            setLoading(false);

            // Fetch Gemini analysis in background
            if (data.metrics) {
              setGeminiAnalysis(null);
              setGeminiError(null);
              
              fetch("http://localhost:3001/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ metrics: data.metrics }),
              })
                .then(async (analysisRes) => {
                  const analysisData = await analysisRes.json().catch(() => ({}));
                  if (analysisRes.ok) {
                    setGeminiAnalysis(Array.isArray(analysisData) ? {} : analysisData);
                  } else {
                    setGeminiError(analysisData?.error || "Failed to generate analysis");
                  }
                })
                .catch((err) => {
                  console.error("Gemini analysis error:", err);
                  setGeminiError(err?.message || "Failed to load analysis");
                });
            }

            // Fetch coaching comparison
            const persona = PERSONAS.find(p => p.slug === slug);
            if (uploadSessionId && persona?.investorId) {
              setCoachingLoading(true);
              setCoachingError(null);
              
              fetch(`http://localhost:3001/coach/${uploadSessionId}/${persona.investorId}`)
                .then(async (coachRes) => {
                  const coachData = await coachRes.json().catch(() => ({}));
                  if (coachRes.ok) {
                    setCoachingData(Array.isArray(coachData) ? {} : coachData);
                  } else {
                    setCoachingError(coachData?.error || "Failed to generate coaching");
                  }
                })
                .catch((err) => {
                  console.error("Coaching error:", err);
                  setCoachingError(err?.message || "Failed to load coaching");
                })
                .finally(() => setCoachingLoading(false));
            }
          } catch (err: any) {
            console.error(err);
            setRawApiData({ error: err.message });
            setAnalysisResult(null);
            setBiasRatios(null);
            setLoading(false);
          }
        };

        load();

    }, [slug]);

    if (loading) {
        return <main className="min-h-screen p-10">Loading profile...</main>;
    }

    if (!profile) {
        return <main className="min-h-screen p-10">Profile not found.</main>;
    }

    const behavioral = rawApiData?.metrics?.behavioral;
    const overtrading = behavioral?.overtrading;
    const lossAversion = behavioral?.loss_aversion;
    const revengeTrading = behavioral?.revenge_trading;
    const martingaleStats = revengeTrading?.martingale_stats || null;
    const martingaleHasSignal =
        (typeof revengeTrading?.tilt_indicator_pct === 'number' && revengeTrading.tilt_indicator_pct > 0.1) ||
        (martingaleStats &&
            Object.values(martingaleStats).some((v: any) => Number.isFinite(Number(v)) && Number(v) > 0.001));
    const formatNumber = (value: number | null | undefined, digits = 2) =>
        value == null || Number.isNaN(value) ? "--" : value.toFixed(digits);
    const formatLabel = (str: string | undefined | null) => {
        if (!str || typeof str !== 'string') return '--';
        return str
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    };
    const biasLabels: Record<string, string> = {
        overtrader: "overtrader",
        loss_aversion: "loss-averse trader",
        revenge_trader: "revenge trader",
        calm_trader: "calm trader"
    };
    const biasEntries = biasRatios ? Object.entries(biasRatios) : [];
    const topBias = biasEntries.length
        ? biasEntries.reduce(
            (acc, [key, value]) =>
            value > acc.value ? { key, value } : acc,
            { key: biasEntries[0][0], value: biasEntries[0][1] }
        )
        : null;
    const topBiasLabel = topBias ? biasLabels[topBias.key] ?? topBias.key : null;
    const topBiasValue = topBias ? Number(topBias.value.toFixed(1)) : null;

    return (
        <main className="min-h-screen p-10 max-w-7xl mx-auto">
        <section className="flex justify-between items-center mb-10">
            {/* LEFT — Change persona */}
            <div className="flex flex-col items-start">
                <span className="text-xs text-gray-500 mb-1">
                Change persona
                </span>

                <select
                value={slug}
                onChange={(e) => router.push(`/profile/${e.target.value}`)}
                className="
                    border rounded-lg px-3 py-2 text-sm transition-colors
                    bg-white text-gray-900 border-gray-300
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                    dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700
                    dark:focus:ring-blue-400
                "
                >
                {PERSONAS.map((p) => (
                    <option key={p.slug} value={p.slug}>
                    {p.label}
                    </option>
                ))}
                </select>
            </div>

            {/* RIGHT — Home */}
            <button
                onClick={() => router.push("/")}
                className="
                px-4 py-2 rounded-lg text-sm font-medium
                border transition-colors
                bg-white text-gray-900 border-gray-300 hover:bg-gray-100
                dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-gray-800
                "
            >
            Home
        </button>
    </section>


        <section className="border rounded-xl p-6 mb-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
                <h3 className="text-lg font-semibold mb-2">
                Bias type ratios
                </h3>

                {biasRatios ? (
                <BiasPieChart ratios={biasRatios} showSummary={false} />
                ) : (
                <p className="text-sm text-gray-500">
                    No bias ratio data yet. Upload a CSV first.
                </p>
                )}
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-2">
                Bias highlight
                </h3>

                {topBiasLabel && topBiasValue != null ? (
                <div className="text-2xl md:text-3xl font-semibold">
                    You are{" "}
                    <CountUp
                    from={0}
                    to={topBiasValue}
                    duration={1.4}
                    className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-pink-500 to-indigo-600"
                    />
                    % a {topBiasLabel}
                </div>
                ) : (
                <p className="text-sm text-gray-600">
                    Upload data to see your bias highlight.
                </p>
                )}

                {geminiAnalysis?.summary ? (
                <p className="mt-3 text-sm text-gray-600">
                    {geminiAnalysis.summary}
                </p>
                ) : geminiError ? (
                <p className="mt-3 text-sm text-red-500">
                    {geminiError}
                </p>
                ) : (
                <p className="mt-3 text-sm text-gray-500 animate-pulse">
                    Loading AI analysis...
                </p>
                )}

                {geminiAnalysis?.suggestions?.length ? (
                <ul className="mt-3 space-y-1 text-sm text-gray-600 list-disc pl-5">
                    {geminiAnalysis.suggestions.map((item, idx) => (
                    <li key={`${idx}-${item}`}>{item}</li>
                    ))}
                </ul>
                ) : null}
            </div>
            </div>
        </section>

        <section className="mt-10 mb-10">
            <h3 className="text-lg font-semibold mb-4">
            Bias breakdown
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border p-5">
                <h4 className="text-base font-semibold mb-2">
                Over trading
                </h4>
                <p className="text-sm text-gray-600">
                Avg trades/hour: {formatNumber(overtrading?.avg_trades_per_hour)}
                </p>
                <p className="text-sm text-gray-600">
                Max trades/hour: {overtrading?.max_trades_in_one_hour ?? "--"}
                </p>
            </div>

            <div className="rounded-2xl border p-5">
                <h4 className="text-base font-semibold mb-2">
                Loss aversion
                </h4>
                <p className="text-sm text-gray-600">
                Avg loss: {formatNumber(lossAversion?.avg_abs_loss)}
                </p>
                <p className="text-sm text-gray-600">
                Avg win: {formatNumber(lossAversion?.avg_win)}
                </p>
                <p className="text-sm text-gray-600">
                Disposition ratio: {formatNumber(lossAversion?.disposition_ratio, 3)}
                </p>
            </div>

            <div className="rounded-2xl border p-5">
                <h4 className="text-base font-semibold mb-2">
                Revenge trading
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                Tilt indicator: <span className={`font-semibold ${revengeTrading?.tilt_indicator_pct && revengeTrading.tilt_indicator_pct > 60 ? 'text-red-600' : ''}`}>
                    {formatNumber(revengeTrading?.tilt_indicator_pct)}%
                </span>
                </p>
                
                {martingaleStats && Object.keys(martingaleStats).length > 0 ? (
                <div className="mt-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Martingale Escalation:</p>
                    {martingaleHasSignal ? (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                    {Object.entries(martingaleStats)
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .slice(0, 12)
                        .map(([streak, avgSize]) => {
                        const streakNum = Number(streak);
                        const size = Number(avgSize);
                        const baselineSize = Number(martingaleStats[0] ?? 0);
                        const hasBaseline = Number.isFinite(baselineSize) && baselineSize !== 0;
                        const pctChange = hasBaseline ? ((size - baselineSize) / baselineSize) * 100 : 0;
                        const isDangerous = hasBaseline && Math.abs(pctChange) > 20 && streakNum > 0;
                        const pctLabel = streakNum > 0
                            ? hasBaseline
                                ? `(${pctChange > 0 ? '+' : ''}${pctChange.toFixed(0)}%)`
                                : "(n/a)"
                            : "";
                        
                        return (
                            <div key={streak} className={`text-xs flex justify-between ${isDangerous ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                            <span>
                                {streakNum === 0 ? 'Baseline' : `After ${streakNum} loss${streakNum > 1 ? 'es' : ''}`}:
                            </span>
                            <span>
                                ${Number.isFinite(size) ? size.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '--'} {pctLabel}
                            </span>
                            </div>
                        );
                        })}
                    </div>
                    ) : (
                        <p className="text-xs text-gray-500 mt-2">No escalation detected (sizes flat).</p>
                    )}
                </div>
                ) : (
                <p className="text-xs text-gray-500 mt-2">No martingale data</p>
                )}
            </div>
            </div>
        </section>

        <section className="mt-10 mb-10">
          <h3 className="text-lg font-semibold mb-4">
            Portfolio timeline
          </h3>
          <PortfolioTimeline sessionId={sessionId} />
        </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* LEFT — Persona */}
        <div>
            <div className="border rounded-xl p-6">
                <h2 className="text-2xl font-semibold mb-6">
                Persona profile
                </h2>

                <div>
                

                    <div className="border rounded-lg p-4">
                        <h3 className="text-lg font-semibold mb-2">
                            Risk & style radar
                        </h3>
                        {personaResult && (
                        <PortfolioRadar
                            result={personaResult}
                            label={profile.name}
                            color="255,159,64"
                        />
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* RIGHT — You */}
        <div className="border rounded-xl p-6">
          <h2 className="text-2xl font-semibold mb-6">
            Your profile
          </h2>

          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2">
              Risk & style radar
            </h3>

            {analysisResult ? (
              <PortfolioRadar
                result={analysisResult}
                label="Your trading profile"
                color="54,162,235"
              />
            ) : (
              <p className="text-sm text-gray-500">
                No uploaded data yet. Upload a CSV first.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Coaching Comparison Section */}
      <section className="mt-10 border rounded-xl p-6">
        <h2 className="text-2xl font-semibold mb-4">
          AI Coaching: How to Trade Like {profile?.name}
        </h2>

        {coachingLoading ? (
          <p className="text-sm text-gray-500 animate-pulse">Loading personalized coaching...</p>
        ) : coachingError ? (
          <div className="rounded-lg bg-red-50 p-4">
            <p className="text-sm text-red-600">{coachingError}</p>
          </div>
        ) : coachingData?.coaching ? (
          <div className="space-y-6">
            {/* Summary */}
            {coachingData.coaching.summary && (
              <div className="rounded-lg bg-blue-50 p-4">
                <h3 className="text-base font-semibold mb-2 text-blue-900">Analysis</h3>
                <p className="text-sm text-blue-800">{coachingData.coaching.summary}</p>
              </div>
            )}

            {/* Alignment Score */}
            {coachingData.comparison?.alignment?.score != null && (
              <div className="rounded-lg border p-4">
                <h3 className="text-base font-semibold mb-2">Alignment Score</h3>
                <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500">
                  {Math.round(coachingData.comparison.alignment.score)}%
                </div>
                <p className="text-xs text-gray-500 mt-1">How closely your trading matches {profile?.name}</p>
              </div>
            )}

            {/* Key Gaps */}
            {coachingData.coaching.keyGaps?.length > 0 && (
              <div className="rounded-lg border p-4">
                <h3 className="text-base font-semibold mb-3">Key Differences</h3>
                <ul className="space-y-2">
                  {coachingData.coaching.keyGaps.map((gap: any, idx: number) => (
                    <li key={idx} className="text-sm text-gray-700">
                      <span className="font-medium">{formatLabel(gap.dimension)}:</span> {gap.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Plan */}
            {coachingData.coaching.actionPlan?.length > 0 && (
              <div className="rounded-lg border p-4">
                <h3 className="text-base font-semibold mb-3">Action Plan</h3>
                <div className="space-y-4">
                  {coachingData.coaching.actionPlan.map((action: any, idx: number) => (
                    <div key={idx} className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-medium text-sm mb-1">{action.objective}</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                        {action.steps?.map((step: string, sIdx: number) => (
                          <li key={sIdx}>{step}</li>
                        ))}
                      </ul>
                      {action.targetThreshold && (
                        <p className="text-xs text-gray-500 mt-1">
                          Target: {formatLabel(action.metric)} {action.targetThreshold}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Guardrails */}
            {coachingData.coaching.guardrails?.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <h3 className="text-base font-semibold mb-2 text-amber-900">Guardrails</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-amber-800">
                  {coachingData.coaching.guardrails.map((rule: string, idx: number) => (
                    <li key={idx}>{rule}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Upload trading data to get personalized coaching.</p>
        )}
      </section>

      <section className="mt-10 border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-3">
          Raw backend response
        </h2>

        <pre className="text-xs bg-gray-50 p-4 rounded overflow-auto">
          {JSON.stringify(rawApiData, null, 2)}
        </pre>
      </section>
    </main>
  );
}
