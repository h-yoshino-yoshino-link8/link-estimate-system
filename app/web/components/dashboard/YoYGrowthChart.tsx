"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { YoYMonthlyPoint } from "../../lib/api/types";

const MONTH_LABELS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

function yen(v: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "\u00a50";
  return `\u00a5${Math.round(n).toLocaleString()}`;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const current = payload.find((p) => p.dataKey === "current_year")?.value ?? 0;
  const previous = payload.find((p) => p.dataKey === "previous_year")?.value ?? 0;
  const rate = previous > 0 ? ((current - previous) / previous) * 100 : 0;

  return (
    <div style={{
      background: "var(--c-surface)",
      border: "1px solid var(--c-border)",
      borderRadius: "var(--r-md)",
      padding: "var(--sp-3)",
      fontSize: 12,
      boxShadow: "var(--shadow-md)",
    }}>
      <p style={{ fontWeight: 600, margin: "0 0 4px" }}>{label}</p>
      <p style={{ margin: "2px 0", color: "#1e40af" }}>今年: {yen(current)}</p>
      <p style={{ margin: "2px 0", color: "#94a3b8" }}>前年: {yen(previous)}</p>
      <p style={{ margin: "4px 0 0", fontWeight: 600, color: rate >= 0 ? "var(--c-success)" : "var(--c-error)" }}>
        成長率: {rate >= 0 ? "+" : ""}{rate.toFixed(1)}%
      </p>
    </div>
  );
}

export default function YoYGrowthChart({ data }: { data: YoYMonthlyPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="card">
        <div className="card-title">前年比売上推移</div>
        <div className="empty-state">売上データがありません</div>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: MONTH_LABELS[d.month - 1] ?? `${d.month}月`,
  }));

  return (
    <div className="card">
      <div className="card-title">前年比売上推移</div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
          <XAxis dataKey="label" style={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v: number) => yen(v)} style={{ fontSize: 11 }} width={80} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="current_year"
            name="今年"
            stroke="#1e40af"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="previous_year"
            name="前年"
            stroke="#94a3b8"
            strokeWidth={1}
            strokeDasharray="5 5"
            dot={{ r: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
