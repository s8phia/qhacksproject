"use client";

import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from "chart.js";

import { Radar } from "react-chartjs-2";
import { useEffect, useState } from "react";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

type Props = {
  result: any;
  label?: string;
  color?: string;
};

export default function RadarChart({
  result,
  label = "Your trading profile",
  color = "54,162,235"
}: Props) {
  if (!result?.normalizedMetrics) return null;

  const m = result.normalizedMetrics;

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const update = () => setIsDark(media.matches);

    update();
    media.addEventListener("change", update);

    return () => media.removeEventListener("change", update);
  }, []);


  const data = {
    labels: [
      "Trade frequency",
      "Avg trade size",
      "Holding patience",
      "After-loss reactivity",
      "Size variability"
    ],
    datasets: [
      {
        label,
        data: [
          m.trade_frequency * 100,
          m.avg_trade_size * 100,
          m.holding_period == null ? 0 : m.holding_period * 100,
          m.after_loss == null ? 0 : m.after_loss * 100,
          m.size_variability * 100
        ],
        fill: true,
        backgroundColor: isDark
          ? "rgba(255,255,255,0.12)"
          : `rgba(${color}, 0.18)`,

        borderColor: isDark
          ? "#ffffff"
          : `rgb(${color})`,

        borderWidth: 2,

        pointBackgroundColor: isDark
          ? "#ffffff"
          : `rgb(${color})`,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        min: 0,
        max: 100,

        ticks: {
          stepSize: 20,
          backdropColor: "transparent",
          color: isDark ? "#ffffff" : "#0f172a"
        },

        pointLabels: {
          color: isDark ? "#ffffff" : "#0f172a",
          font: {
            size: 12
          }
        },

        grid: {
          color: isDark
            ? "rgba(255,255,255,0.25)"
            : "rgba(15,23,42,0.12)"
        },

        angleLines: {
          color: isDark
            ? "rgba(255,255,255,0.25)"
            : "rgba(15,23,42,0.12)"
        }
      }
    },
    plugins: {
      legend: {
        labels: {
          color: isDark ? "#ffffff" : "#0f172a"
        }
      }
    }
  };

  return (
    <div
      className="
        h-[260px]
        rounded-lg
        bg-blue-50
        dark:bg-slate-800
        p-2
      "
    >
      <Radar
        key={isDark ? "dark" : "light"}
        data={data}
        options={options as any}
      />
    </div>
  );
}