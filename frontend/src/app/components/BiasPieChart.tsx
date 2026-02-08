"use client";


import { PieChart } from "@mui/x-charts/PieChart";


const LABELS: Record<string, string> = {
  overtrader: "Overtrading",
  loss_aversion: "Loss aversion",
  revenge_trader: "Revenge trading",
  calm_trader: "Calm trading"
};


const COLORS: Record<string, string> = {
  overtrader: "#c0207b",
  loss_aversion: "#1e0237",
  revenge_trader: "#0c0810",
  calm_trader: "#561557"
};


type Props = {
  ratios: Record<string, number>;
  showSummary?: boolean;
};


export default function BiasPieChart({ ratios, showSummary = true }: Props) {


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
    <div className="w-full flex flex-col items-center">
      <PieChart
        height={240}
        margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
        series={[
          {
            data,
            highlightScope: { faded: "global", highlighted: "item" },
            faded: { innerRadius: 28, additionalRadius: -10 },
          },
        ]}
        slotProps={{
          legend: { hidden: true },
        }}
      />




      {showSummary && (
        <div className="mt-8 text-sm text-white">
          <span className="font-semibold text-white">
            Highest bias:
          </span>{" "}
          {top.label} ({top.value.toFixed(1)}%)
        </div>
      )}


      <div className="mt-8 w-fit grid grid-cols-2 gap-x-16 gap-y-2 text-xs text-[#8A789A]">
        {data.map((item) => (
          <div key={item.id} className="flex items-center gap-4">
            <span
              className="inline-block h-4 w-4 rounded-full"
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


