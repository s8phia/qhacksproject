"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PortfolioRadar from "@/app/components/RadarChart";
import BiasPieChart from "@/app/components/BiasPieChart";

type ProfileData = {
  name: string;
  avatarUrl?: string;
  bio?: string;
  tradingStyle?: string;
  riskProfile?: string;
  stats?: Record<string, string | number>;
};

const PERSONAS = [
  { label: "Warren Buffett", slug: "warren-buffett" },
  { label: "Cathie Wood", slug: "cathie-wood" },
  { label: "Michael Burry", slug: "michael-burry" }
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

  // 🔽 only for dumping / debugging
  const [rawApiData, setRawApiData] = useState<any>(null);

  useEffect(() => {
    if (!slug) return;

    setLoading(true);

    setProfile({
      name: slug.replace(/-/g, " ")
    });

    setPersonaResult(HARDCODED_PERSONA_RADAR[slug]);

    // 🔽 pull latest uploaded metrics
    fetch("http://localhost:3001/api/uploads/usertrades")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("No uploaded data yet");
        }
        return res.json();
      })
      .then((data) => {
        setRawApiData(data);

        const pm = data.metrics?.portfolio_metrics;
        const biasTypeRatios = data.metrics?.bias_type_ratios ?? null;

        if (!pm) {
          setAnalysisResult(null);
          setBiasRatios(biasTypeRatios);
          return;
        }

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
      })

      .catch((err) => {
        console.error(err);
        setRawApiData({ error: err.message });
        setAnalysisResult(null);
        setBiasRatios(null);
      })
      .finally(() => {
        setLoading(false);
      });

  }, [slug]);

  if (loading) {
    return <main className="min-h-screen p-10">Loading profile...</main>;
  }

  if (!profile) {
    return <main className="min-h-screen p-10">Profile not found.</main>;
  }

  return (
    <main className="min-h-screen p-10 max-w-7xl mx-auto">
      {/* Header */}
      <section className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-6">
          <img
            src={getPersonaImage(slug)}
            alt={profile.name}
            className="w-32 h-32 rounded-full object-cover border"
          />

          <div>
            <h1 className="text-4xl font-bold capitalize">
              {profile.name}
            </h1>
            <p className="text-gray-600">
              {profile.tradingStyle ?? "Trading style coming soon"}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-xs text-gray-500 mb-1">
            Change persona
          </span>

          <select
            value={slug}
            onChange={(e) =>
              router.push(`/profile/${e.target.value}`)
            }
            className="border rounded-lg px-3 py-2 text-sm"
          >
            {PERSONAS.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* LEFT — Persona */}
        <div>
          <div className="border rounded-xl p-6">
            <h2 className="text-2xl font-semibold mb-6">
              Persona profile
            </h2>

            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-2">
                Summary
              </h3>
              <ul className="list-disc pl-5 text-gray-700 space-y-1">
                <li>Persona behavioural summary placeholder</li>
                <li>Typical strategy and signals placeholder</li>
                <li>Risk posture and style placeholder</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">
                Risk & style radar
              </h3>

              <div className="border rounded-lg p-4">
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

          <div>
            <h3 className="text-lg font-semibold mb-2">
              Risk & style radar
            </h3>

            <div className="border rounded-lg p-4">
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

          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-2">
              Bias type ratios
            </h3>

            <div className="border rounded-lg p-4">
              {biasRatios ? (
                <BiasPieChart ratios={biasRatios} />
              ) : (
                <p className="text-sm text-gray-500">
                  No bias ratio data yet. Upload a CSV first.
                </p>
              )}
            </div>
          </div>
        </div>
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