"use client";

import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, AreaChart, Area, LineChart,
} from "recharts";
import type { BankDashboardData } from "../../lib/api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TooltipFormatter = any;

function yen(value: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "¥0";
  if (Math.abs(n) >= 10000) return `¥${(n / 10000).toFixed(1)}万`;
  return `¥${Math.round(n).toLocaleString()}`;
}

function yenFull(value: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "¥0";
  return `¥${Math.round(n).toLocaleString()}`;
}

function shortMonth(m: string) {
  const parts = m.split("-");
  return parts.length === 2 ? `${parseInt(parts[1])}月` : m;
}

export default function BankDashboard({ data }: { data: BankDashboardData }) {
  const marginData = data.monthly_margin_trend.map((d) => ({
    ...d,
    month: shortMonth(d.month),
  }));

  const cashData = data.cash_position_trend.map((d) => ({
    ...d,
    month: shortMonth(d.month),
  }));

  const dsoData = data.dso_trend.map((d) => ({
    ...d,
    month: shortMonth(d.month),
  }));

  return (
    <div>
      {/* KPI サマリーカード */}
      <div className="kpi-grid" style={{ marginBottom: "var(--sp-4)" }}>
        <div className="kpi-card">
          <p className="kpi-label">DSO（債権回収日数）</p>
          <p className={`kpi-value ${data.dso <= 45 ? "is-positive" : data.dso <= 60 ? "" : "is-negative"}`}>
            {data.dso}日
          </p>
          <p className="kpi-sub">業界平均: 30-45日</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">売掛/買掛比率</p>
          <p className={`kpi-value ${data.current_ratio >= 1.5 ? "is-positive" : data.current_ratio >= 1.0 ? "" : "is-negative"}`}>
            {data.current_ratio.toFixed(2)}
          </p>
          <p className="kpi-sub">1.5以上が健全</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">運転資金</p>
          <p className={`kpi-value ${data.working_capital >= 0 ? "is-positive" : "is-negative"}`}>
            {yenFull(data.working_capital)}
          </p>
          <p className="kpi-sub">売掛残 - 買掛残</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">平均回収/支払サイト</p>
          <p className="kpi-value" style={{ fontSize: 20 }}>
            {data.avg_collection_days}日 / {data.avg_payment_days}日
          </p>
          <p className="kpi-sub">回収 &lt; 支払 が理想</p>
        </div>
      </div>

      {/* 月次粗利率トレンド */}
      <div className="card" style={{ marginBottom: "var(--sp-4)" }}>
        <div className="card-title">月次売上・粗利トレンド（12ヶ月）</div>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <ComposedChart data={marginData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border-1)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => yen(v)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `${v}%`}
                domain={[0, 100]}
              />
              <Tooltip
                formatter={((value: number, name: string) => {
                  if (name === "粗利率") return [`${value.toFixed(1)}%`, name];
                  return [yenFull(value), name];
                }) as TooltipFormatter}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="sales" name="売上" fill="var(--c-accent)" opacity={0.7} />
              <Bar yAxisId="left" dataKey="cost" name="原価" fill="var(--c-text-4)" opacity={0.5} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="gross_margin_rate"
                name="粗利率"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="dash-grid-2">
        {/* キャッシュポジション推移 */}
        <div className="card">
          <div className="card-title">キャッシュポジション推移</div>
          <div style={{ width: "100%", height: 250 }}>
            <ResponsiveContainer>
              <AreaChart data={cashData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border-1)" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => yen(v)} />
                <Tooltip formatter={((value: number, name: string) => [yenFull(value), name]) as TooltipFormatter} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="receivable"
                  name="売掛残"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.2}
                />
                <Area
                  type="monotone"
                  dataKey="payable"
                  name="買掛残"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.2}
                />
                <Area
                  type="monotone"
                  dataKey="cash_position"
                  name="CP"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* DSO推移 */}
        <div className="card">
          <div className="card-title">DSO推移（売上債権回収日数）</div>
          <div style={{ width: "100%", height: 250 }}>
            <ResponsiveContainer>
              <LineChart data={dsoData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border-1)" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v}日`} />
                <Tooltip formatter={((value: number) => [`${value}日`, "DSO"]) as TooltipFormatter} />
                <Line
                  type="monotone"
                  dataKey="dso"
                  name="DSO"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#f59e0b" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p style={{ fontSize: 11, color: "var(--c-text-4)", marginTop: "var(--sp-2)" }}>
            DSO = 売掛残高 / (累計売上 / 365)。30日以下が理想。
          </p>
        </div>
      </div>
    </div>
  );
}
