"use client";

import AgingChart from "./AgingChart";
import type { CollectionMetrics, UnpaidInvoice } from "../../lib/api/types";

type Props = {
  metrics: CollectionMetrics;
  invoices: UnpaidInvoice[];
};

function yen(v: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "\u00a50";
  return `\u00a5${Math.round(n).toLocaleString()}`;
}

function agingBadgeClass(cat: string) {
  if (cat === "90日超過") return "aging-badge over90";
  if (cat === "60日超過") return "aging-badge over60";
  if (cat === "30日超過") return "aging-badge over30";
  return "aging-badge current";
}

export default function PaymentOverview({ metrics, invoices }: Props) {
  const dsoClass = metrics.dso <= 40 ? "good" : metrics.dso <= 60 ? "warning" : "danger";
  const rateClass = metrics.collection_rate >= 95 ? "good" : metrics.collection_rate >= 90 ? "warning" : "danger";

  return (
    <div>
      {/* KPIカード4枚 */}
      <div className="aging-kpi-grid">
        <div className="kpi-card">
          <p className="kpi-label">DSO（回収日数）</p>
          <p className={`kpi-value aging-kpi-value ${dsoClass}`}>{metrics.dso}日</p>
          <p className="kpi-sub">業界平均: 40日</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">回収率</p>
          <p className={`kpi-value aging-kpi-value ${rateClass}`}>{metrics.collection_rate}%</p>
          <p className="kpi-sub">目標: 95%以上</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">未回収額合計</p>
          <p className="kpi-value">{yen(metrics.total_receivable)}</p>
          <p className="kpi-sub">請求済み未入金</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">期日超過</p>
          <p className="kpi-value" style={{ color: metrics.overdue_count > 0 ? "var(--c-error)" : "inherit" }}>
            {metrics.overdue_count}件
          </p>
          <p className="kpi-sub">{yen(metrics.total_overdue)}</p>
        </div>
      </div>

      {/* メインコンテンツ: チャート + テーブル */}
      <div className="payment-grid">
        {/* 左: エイジングチャート */}
        <AgingChart buckets={metrics.aging_buckets} />

        {/* 右: 未入金一覧テーブル */}
        <div className="card">
          <div className="card-title">未入金一覧（{invoices.length}件）</div>
          {invoices.length === 0 ? (
            <p style={{ textAlign: "center", color: "#64748b", padding: "2rem 0" }}>
              未入金の請求はありません
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>案件名</th>
                    <th>顧客</th>
                    <th>請求額</th>
                    <th>残額</th>
                    <th>入金期日</th>
                    <th>超過</th>
                    <th>状態</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.invoice_id}>
                      <td><strong>{inv.project_name}</strong></td>
                      <td>{inv.customer_name}</td>
                      <td>{yen(inv.invoice_amount)}</td>
                      <td>{yen(inv.remaining_amount)}</td>
                      <td>{inv.due_date}</td>
                      <td>
                        {inv.days_overdue > 0 ? (
                          <span style={{ color: "var(--c-error)", fontWeight: 600 }}>
                            {inv.days_overdue}日
                          </span>
                        ) : (
                          <span style={{ color: "var(--c-success)" }}>期日内</span>
                        )}
                      </td>
                      <td><span className={agingBadgeClass(inv.aging_category)}>{inv.aging_category}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
