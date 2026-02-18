"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getDashboardOverview, getInvoices, getPayments, type DashboardOverview, type Invoice, type Payment } from "../lib/api";

function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function yen(value: number) {
  if (!Number.isFinite(value)) return "¥0";
  return `¥${Math.round(value).toLocaleString()}`;
}

function asDate(dateText?: string | null) {
  if (!dateText) return null;
  const d = new Date(dateText);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function ymd(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function ExecutiveDashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const [overviewData, invoiceRows, paymentRows] = await Promise.all([
        getDashboardOverview(),
        getInvoices(),
        getPayments(),
      ]);
      setOverview(overviewData);
      setInvoices(invoiceRows);
      setPayments(paymentRows);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ダッシュボード取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const totalInvoiceAmount = useMemo(
    () => invoices.reduce((sum, row) => sum + safeNum(row.invoice_amount), 0),
    [invoices],
  );
  const totalPaymentAmount = useMemo(
    () => payments.reduce((sum, row) => sum + safeNum(row.ordered_amount), 0),
    [payments],
  );

  const invoiceCollectionRate = useMemo(() => {
    if (totalInvoiceAmount <= 0) return 0;
    const receivable = overview?.receivable_balance ?? 0;
    return Math.max(0, Math.min(100, ((totalInvoiceAmount - receivable) / totalInvoiceAmount) * 100));
  }, [overview, totalInvoiceAmount]);

  const paymentSettlementRate = useMemo(() => {
    if (totalPaymentAmount <= 0) return 0;
    const payable = overview?.payable_balance ?? 0;
    return Math.max(0, Math.min(100, ((totalPaymentAmount - payable) / totalPaymentAmount) * 100));
  }, [overview, totalPaymentAmount]);

  const monthlySalesPoints = overview?.monthly_sales_current_year ?? [];
  const monthlyPeak = useMemo(
    () => (monthlySalesPoints.length > 0 ? Math.max(...monthlySalesPoints.map((x) => x.amount), 1) : 1),
    [monthlySalesPoints],
  );

  const overdueInvoices = useMemo(() => {
    const today = new Date();
    return invoices
      .filter((inv) => inv.remaining_amount > 0)
      .map((inv) => {
        const explicitDue = asDate(inv.due_date);
        const billed = asDate(inv.billed_at);
        const due = explicitDue ?? (billed ? addDays(billed, 30) : null);
        return { inv, due };
      })
      .filter((x) => x.due && x.due < today)
      .sort((a, b) => (a.due && b.due ? a.due.getTime() - b.due.getTime() : 0));
  }, [invoices]);

  const overdueAmount = useMemo(
    () => overdueInvoices.reduce((sum, x) => sum + safeNum(x.inv.remaining_amount), 0),
    [overdueInvoices],
  );

  const growthRate = overview?.yoy_growth_rate ?? 0;
  const hasLastYearData = (overview?.last_year_ytd_sales ?? 0) > 0;
  const growthText = growthRate === 0 && !hasLastYearData
    ? "データ不足"
    : `${growthRate >= 0 ? "+" : ""}${growthRate.toFixed(1)}%`;

  return (
    <main className="page">
      {/* Header */}
      <div className="dash-header">
        <div>
          <h1>経営ダッシュボード</h1>
          <p className="dash-header-sub">売上・資金・案件進捗を一画面で把握する経営ダッシュボード</p>
        </div>
        <div style={{ display: "flex", gap: "var(--sp-2)" }}>
          <Link href="/projects" className="btn btn-primary" style={{ textDecoration: "none" }}>
            案件一覧を開く
          </Link>
          <button className="btn" onClick={() => void load()} disabled={loading}>
            最新に更新
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="dash-kpi-grid">
        <div className="kpi-card">
          <p className="kpi-label">今月売上</p>
          <p className="kpi-value">{yen(overview?.current_month_sales ?? 0)}</p>
          <p className="kpi-sub">当月請求ベース</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">通年売上（YTD）</p>
          <p className="kpi-value">{yen(overview?.ytd_sales ?? 0)}</p>
          <p className="kpi-sub">年初からの累計</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">前年比成長率</p>
          <p className={`kpi-value ${growthRate >= 0 ? "growth-plus" : "growth-minus"}`}>{growthText}</p>
          <p className="kpi-sub">前年同期比</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">稼働案件数</p>
          <p className="kpi-value">{overview?.active_project_count ?? 0}件</p>
          <p className="kpi-sub">進行中案件</p>
        </div>
      </div>

      {/* Section Grid: Chart + Finance Health */}
      <div className="dash-section-grid">
        {/* Sales Chart */}
        <div className="card">
          <h2 className="card-title">売上推移（今年）</h2>
          <div className="chart-bar-grid">
            {monthlySalesPoints.map((point) => (
              <div key={point.month} className="chart-bar-col">
                <div
                  className="chart-bar-fill"
                  style={{ height: `${Math.max((point.amount / monthlyPeak) * 100, 2)}%` }}
                />
                <span className="chart-bar-label">{point.month}</span>
                <span className="chart-bar-value">{yen(point.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Finance Health */}
        <div className="card">
          <h2 className="card-title">資金/回収の健全性</h2>
          <div>
            <div className="stat-row">
              <span className="stat-label">売掛残（未回収）</span>
              <span className="stat-value">{yen(overview?.receivable_balance ?? 0)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">買掛残（未払）</span>
              <span className="stat-value">{yen(overview?.payable_balance ?? 0)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">全期間売上</span>
              <span className="stat-value">{yen(overview?.all_time_sales ?? 0)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">期限超過請求</span>
              <span className="stat-value">{overdueInvoices.length}件 / {yen(overdueAmount)}</span>
            </div>
          </div>
          <div style={{ marginTop: "var(--sp-4)", display: "grid", gap: "var(--sp-3)" }}>
            <div>
              <div className="stat-row" style={{ borderBottom: "none", paddingBottom: 0 }}>
                <span className="stat-label">請求回収率</span>
                <span className="stat-value">{invoiceCollectionRate.toFixed(1)}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${invoiceCollectionRate}%` }} />
              </div>
            </div>
            <div>
              <div className="stat-row" style={{ borderBottom: "none", paddingBottom: 0 }}>
                <span className="stat-label">支払消込率</span>
                <span className="stat-value">{paymentSettlementRate.toFixed(1)}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill progress-fill-cyan" style={{ width: `${paymentSettlementRate}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="card">
        <h2 className="card-title">要対応アラート</h2>
        {overdueInvoices.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 13 }}>期限超過の請求はありません</p>
        ) : (
          <div style={{ display: "grid", gap: "var(--sp-2)" }}>
            {overdueInvoices.slice(0, 6).map(({ inv, due }) => (
              <div key={inv.invoice_id} className="alert-item">
                <span>{inv.invoice_id} / 案件 {inv.project_id} / 期日 {due ? ymd(due) : "-"} / 残 {yen(inv.remaining_amount)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-muted" style={{ fontSize: 12, marginTop: "var(--sp-3)" }}>
          対応は「案件管理 → 該当案件」で請求/入金更新を実行してください。
        </p>
      </div>

      {/* Active Projects Table */}
      <div className="card">
        <h2 className="card-title">稼働案件（どこが動いているか）</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>案件</th>
                <th>顧客</th>
                <th>ステータス</th>
                <th>売上</th>
                <th>原価</th>
                <th>粗利見込</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {(overview?.active_projects ?? []).map((project) => (
                <tr key={project.project_id}>
                  <td>
                    {project.project_id}
                    <br />
                    <span className="text-muted">{project.project_name}</span>
                  </td>
                  <td>{project.customer_name}</td>
                  <td>{project.project_status}</td>
                  <td>{yen(project.invoice_total_amount)}</td>
                  <td>{yen(project.payment_total_amount)}</td>
                  <td>{yen(project.gross_estimate)}</td>
                  <td>
                    <Link href={`/projects/${project.project_id}`} className="btn btn-sm btn-primary" style={{ textDecoration: "none" }}>
                      案件を開く
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {message ? <p className="message">{message}</p> : null}
    </main>
  );
}
