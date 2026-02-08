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
  color = "54,162,235" // default blue
}: Props) {
  if (!result?.normalizedMetrics) return null;

  const m = result.normalizedMetrics;

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
        backgroundColor: `rgba(${color},0.2)`,
        borderColor: `rgb(${color})`
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
        ticks: { stepSize: 20 }
      }
    }
  };

  return (
    <div style={{ height: 260 }}>
      <Radar data={data} options={options} />
    </div>
  );
}