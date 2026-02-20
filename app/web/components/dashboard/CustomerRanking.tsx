"use client";

import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { CustomerRankingItem } from "../../lib/api/types";

type SortKey = "project_count" | "total_sales" | "margin_rate";

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

function trendIcon(rate: number) {
  if (rate > 0) return <span className="trend-up" style={{ color: "var(--c-success)", fontWeight: 600 }}>&#8593;</span>;
  if (rate < 0) return <span className="trend-down" style={{ color: "var(--c-error)", fontWeight: 600 }}>&#8595;</span>;
  return <span className="trend-flat" style={{ color: "var(--c-text-4)", fontWeight: 600 }}>&rarr;</span>;
}

export default function CustomerRanking({ data }: { data: CustomerRankingItem[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("total_sales");

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      if (sortKey === "project_count") return b.project_count - a.project_count;
      if (sortKey === "total_sales") return b.total_sales - a.total_sales;
      return b.margin_rate - a.margin_rate;
    });
  }, [data, sortKey]);

  const chartData = useMemo(() => {
    return sorted.slice(0, 10).map((c) => ({
      name: c.customer_name.length > 8 ? c.customer_name.slice(0, 8) + "..." : c.customer_name,
      sales: c.total_sales,
    }));
  }, [sorted]);

  if (data.length === 0) {
    return (
      <div className="card">
        <div className="card-title">顧客ランキング</div>
        <div className="empty-state">顧客データがありません</div>
      </div>
    );
  }

  const sortButtons: { key: SortKey; label: string }[] = [
    { key: "project_count", label: "発注件数" },
    { key: "total_sales", label: "売上高" },
    { key: "margin_rate", label: "利益率" },
  ];

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-4)" }}>
        <div className="card-title" style={{ margin: 0 }}>顧客ランキング</div>
        <div style={{ display: "flex", gap: "var(--sp-1)" }}>
          {sortButtons.map((s) => (
            <button
              key={s.key}
              className={`btn btn-sm ${sortKey === s.key ? "btn-primary" : ""}`}
              onClick={() => setSortKey(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "var(--sp-4)" }}>
        <ResponsiveContainer width="100%" height={Math.max(chartData.length * 36, 120)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
            <XAxis type="number" tickFormatter={(v: number) => yen(v)} style={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={90} style={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [yen(Number(v)), "売上"]} />
            <Bar dataKey="sales" radius={[0, 4, 4, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill="#1e40af" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>顧客名</th>
              <th className="text-right">発注件数</th>
              <th className="text-right">売上高</th>
              <th className="text-right">利益</th>
              <th className="text-right">利益率</th>
              <th>トレンド</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr key={c.customer_id}>
                <td style={{ fontWeight: 600, color: "var(--c-text-3)" }}>{i + 1}</td>
                <td>{c.customer_name}</td>
                <td className="text-right">{c.project_count}件</td>
                <td className="text-right">{yen(c.total_sales)}</td>
                <td className="text-right">{yen(c.total_profit)}</td>
                <td className="text-right">
                  <span style={{
                    fontWeight: 600,
                    color: c.margin_rate >= 30 ? "var(--c-success)" : c.margin_rate >= 20 ? "var(--c-text)" : "var(--c-error)",
                  }}>
                    {pct(c.margin_rate)}
                  </span>
                </td>
                <td>{trendIcon(c.total_profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
