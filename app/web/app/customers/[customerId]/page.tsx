"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  getCustomerDetail,
  type CustomerDetail,
  type Project,
  marginRate,
} from "../../../lib/api";

const BarChart = dynamic(
  () => import("recharts").then((m) => ({ default: m.BarChart })),
  { ssr: false },
);
const Bar = dynamic(
  () => import("recharts").then((m) => ({ default: m.Bar })),
  { ssr: false },
);
const XAxis = dynamic(
  () => import("recharts").then((m) => ({ default: m.XAxis })),
  { ssr: false },
);
const YAxis = dynamic(
  () => import("recharts").then((m) => ({ default: m.YAxis })),
  { ssr: false },
);
const Tooltip = dynamic(
  () => import("recharts").then((m) => ({ default: m.Tooltip })),
  { ssr: false },
);
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => ({ default: m.ResponsiveContainer })),
  { ssr: false },
);

function yen(n: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "\u00a50";
  return `\u00a5${Math.round(v).toLocaleString()}`;
}

function pct(n: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0.0%";
  return `${v.toFixed(1)}%`;
}

function statusBadgeClass(status: string) {
  if (status === "見積中") return "badge badge-default";
  if (status === "受注") return "badge badge-blue";
  if (status === "施工中") return "badge badge-warning";
  if (status === "完了" || status === "請求済") return "badge badge-success";
  if (status === "入金済") return "badge badge-success";
  if (status === "失注") return "badge badge-error";
  return "badge badge-default";
}

function customerStatusBadgeClass(status: string) {
  if (status === "取引中") return "badge badge-success";
  if (status === "休止中") return "badge badge-default";
  if (status === "新規") return "badge badge-blue";
  return "badge badge-default";
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params?.customerId as string | undefined;

  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    getCustomerDetail(customerId)
      .then(setDetail)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [customerId]);

  const chartData = useMemo(() => {
    if (!detail?.monthly_sales) return [];
    return detail.monthly_sales.map((ms) => ({
      month: ms.month,
      amount: ms.amount,
    }));
  }, [detail]);

  if (loading) {
    return (
      <main className="page">
        <p style={{ textAlign: "center", padding: 40, color: "var(--c-text-4)" }}>読み込み中...</p>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="page">
        <p style={{ textAlign: "center", padding: 40, color: "var(--c-text-4)" }}>顧客が見つかりません</p>
      </main>
    );
  }

  const c = detail.customer;

  return (
    <main className="page">
      {/* Header */}
      <div className="customer-detail-header">
        <Link href="/customers" className="back-link" style={{ textDecoration: "none" }}>
          &larr; 顧客一覧に戻る
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{c.customer_name}</h1>
          <span className={customerStatusBadgeClass(c.status)}>{c.status}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <p className="kpi-label">取引件数</p>
          <p className="kpi-value">{detail.project_count}件</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">累計売上</p>
          <p className="kpi-value">{yen(detail.total_sales)}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">累計利益</p>
          <p className={`kpi-value ${detail.total_profit >= 0 ? "is-positive" : "is-negative"}`}>
            {yen(detail.total_profit)}
          </p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">平均利益率</p>
          <p className={`kpi-value ${detail.margin_rate >= 30 ? "is-positive" : detail.margin_rate >= 20 ? "" : "is-negative"}`}>
            {pct(detail.margin_rate)}
          </p>
        </div>
      </div>

      {/* Monthly Sales Chart */}
      {chartData.length > 0 && (
        <div className="card customer-chart-wrap">
          <div className="card-title">月次売上推移</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ left: 0, right: 20, top: 10, bottom: 0 }}>
              <XAxis dataKey="month" style={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v: number) => yen(v)} style={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [yen(Number(v)), "売上"]} />
              <Bar dataKey="amount" fill="#1e40af" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Projects Table */}
      <div className="card">
        <div className="card-title">案件一覧（{detail.projects.length}件）</div>
        {detail.projects.length === 0 ? (
          <div className="empty-state">この顧客の案件はまだありません</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>案件名</th>
                  <th>ステータス</th>
                  <th>作成日</th>
                </tr>
              </thead>
              <tbody>
                {detail.projects.map((p) => (
                  <tr key={p.project_id}>
                    <td>
                      <Link href={`/projects/${p.project_id}`} style={{ color: "var(--c-primary)", textDecoration: "none", fontWeight: 500 }}>
                        {p.project_name}
                      </Link>
                    </td>
                    <td>
                      <span className={statusBadgeClass(p.project_status)}>{p.project_status}</span>
                    </td>
                    <td style={{ color: "var(--c-text-3)", fontSize: 12 }}>
                      {p.created_at?.slice(0, 10) ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
