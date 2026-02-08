"use client";

import { PieChart } from "@mui/x-charts/PieChart";

const LABELS: Record<string, string> = {
  overtrader: "Overtrading",
  loss_aversion: "Loss aversion",
  revenge_trader: "Revenge trading",
  calm_trader: "Calm trading"
};

const COLORS: Record<string, string> = {
  overtrader: "#ef4444",
  loss_aversion: "#f59e0b",
  revenge_trader: "#8b5cf6",
  calm_trader: "#10b981"
};

type Props = {
  ratios: Record<string, number>;
};

export default function BiasPieChart({ ratios }: Props) {
  const data = Object.keys(LABELS).map((key, index) => ({
    id: index,
    label: LABELS[key],
    value: Number(ratios?.[key] ?? 0),
    color: COLORS[key]
  }));

  const top = data.reduce(
    (acc, item) => (item.value > acc.value ? item : acc),
    data[0]
  );

  return (
    <div className="w-full">
      <PieChart
        height={240}
        margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
        series={[
          {
            data,
            highlightScope: { faded: "global", highlighted: "item" },
            faded: { innerRadius: 28, additionalRadius: -10 }
          }
        ]}
      />

      <div className="mt-3 text-sm text-gray-600">
        <span className="font-semibold text-gray-800">
          Highest bias:
        </span>{" "}
        {top.label} ({top.value.toFixed(1)}%)
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
        {data.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span>
              {item.label}: {item.value.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
