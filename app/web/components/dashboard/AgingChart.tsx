"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from "recharts";
import type { AgingBucket } from "../../lib/api/types";

type Props = { buckets: AgingBucket[] };

const COLORS: Record<string, string> = {
  "正常": "#1e40af",
  "30日超過": "#d97706",
  "60日超過": "#ea580c",
  "90日超過": "#dc2626",
};

function yen(v: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "\u00a50";
  return `\u00a5${Math.round(n).toLocaleString()}`;
}

export default function AgingChart({ buckets }: Props) {
  const hasData = buckets.some(b => b.count > 0);
  if (!hasData) {
    return (
      <div className="card">
        <div className="card-title">エイジング分析</div>
        <p style={{ textAlign: "center", color: "#64748b", padding: "2rem 0" }}>
          未入金の請求はありません
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">エイジング分析</div>
      <div className="chart-container" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} margin={{ top: 20, right: 20, bottom: 5, left: 20 }}>
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v: number) => yen(v)} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [yen(Number(v)), "未回収額"]} />
            <Bar dataKey="total_amount" name="未回収額" radius={[4, 4, 0, 0]}>
              {buckets.map((b, i) => (
                <Cell key={i} fill={COLORS[b.label] ?? "#94a3b8"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
