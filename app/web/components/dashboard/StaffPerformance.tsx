"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { StaffPerformance as StaffPerformanceType } from "../../lib/api/types";

function yen(v: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "\u00a50";
  return `\u00a5${Math.round(n).toLocaleString()}`;
}

function pct(v: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0.0%";
  return `${n.toFixed(1)}%`;
}

function marginColor(rate: number): string {
  if (rate >= 30) return "var(--c-success)";
  if (rate >= 20) return "var(--c-warning)";
  return "var(--c-error)";
}

export default function StaffPerformanceView({ data }: { data: StaffPerformanceType[] }) {
  if (data.length === 0) {
    return (
      <div className="card">
        <div className="card-title">スタッフ別実績</div>
        <div className="empty-state">スタッフデータがありません</div>
      </div>
    );
  }

  const chartData = data.map((s) => ({
    name: s.display_name,
    sales: s.total_sales,
  }));

  return (
    <div className="card">
      <div className="card-title">スタッフ別実績</div>

      {/* Bar Chart */}
      <div style={{ marginBottom: "var(--sp-5)" }}>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
            <XAxis dataKey="name" style={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v: number) => yen(v)} style={{ fontSize: 11 }} width={80} />
            <Tooltip formatter={(v) => [yen(Number(v)), "売上"]} />
            <Bar dataKey="sales" fill="#1e40af" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Staff Cards Grid */}
      <div className="staff-grid" style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "var(--sp-3)",
      }}>
        {data.map((s) => (
          <div
            key={s.staff_id}
            className="staff-card"
            style={{
              border: "1px solid var(--c-border)",
              borderRadius: "var(--r-md)",
              padding: "var(--sp-4)",
              background: "var(--c-bg)",
            }}
          >
            <div
              className="staff-card-name"
              style={{ fontWeight: 600, fontSize: 14, marginBottom: "var(--sp-3)" }}
            >
              {s.display_name}
            </div>
            <div className="staff-card-stats" style={{ display: "grid", gap: "var(--sp-2)", fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--c-text-3)" }}>売上</span>
                <span style={{ fontWeight: 600 }}>{yen(s.total_sales)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--c-text-3)" }}>粗利</span>
                <span style={{ fontWeight: 600 }}>{yen(s.total_profit)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--c-text-3)" }}>利益率</span>
                <span style={{ fontWeight: 700, color: marginColor(s.margin_rate) }}>
                  {pct(s.margin_rate)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--c-text-3)" }}>案件数</span>
                <span style={{ fontWeight: 600 }}>{s.project_count}件</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
