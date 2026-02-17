"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getDashboardOverview, getInvoices, getPayments, type DashboardOverview, type Invoice, type Payment } from "../lib/api";

function yen(value: number) {
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
    () => invoices.reduce((sum, row) => sum + Number(row.invoice_amount || 0), 0),
    [invoices],
  );
  const totalPaymentAmount = useMemo(
    () => payments.reduce((sum, row) => sum + Number(row.ordered_amount || 0), 0),
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
        const billed = asDate(inv.billed_at);
        const due = billed ? addDays(billed, 30) : null;
        return { inv, due };
      })
      .filter((x) => x.due && x.due < today)
      .sort((a, b) => (a.due && b.due ? a.due.getTime() - b.due.getTime() : 0));
  }, [invoices]);

  const overdueAmount = useMemo(
    () => overdueInvoices.reduce((sum, x) => sum + Number(x.inv.remaining_amount || 0), 0),
    [overdueInvoices],
  );

  const growthRate = overview?.yoy_growth_rate ?? 0;
  const growthText = `${growthRate >= 0 ? "+" : ""}${growthRate.toFixed(1)}%`;

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Management View</p>
        <h1>経営ダッシュボード</h1>
        <p className="sub">
          売上・資金・案件進捗・未入金リスクを1画面で把握し、次の意思決定につなげる画面です。
        </p>
        <div className="hero-actions">
          <Link href="/projects" className="link-btn">
            案件一覧へ
          </Link>
          <Link href="/finance" className="link-btn ghost">
            会計センターへ
          </Link>
          <button onClick={() => void load()} disabled={loading}>
            最新に更新
          </button>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card">
          <p className="kpi-label">今月売上</p>
          <p className="kpi-value">{yen(overview?.current_month_sales ?? 0)}</p>
          <p className="kpi-note">当月請求ベース</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">通年売上（YTD）</p>
          <p className="kpi-value">{yen(overview?.ytd_sales ?? 0)}</p>
          <p className="kpi-note">年初からの累計</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">前年比成長率</p>
          <p className={`kpi-value ${growthRate >= 0 ? "kpi-growth-plus" : "kpi-growth-minus"}`}>{growthText}</p>
          <p className="kpi-note">前年同期比</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">稼働案件数</p>
          <p className="kpi-value">{overview?.active_project_count ?? 0}件</p>
          <p className="kpi-note">進行中案件</p>
        </article>
      </section>

      <section className="dash-grid">
        <article className="panel">
          <h2>売上推移（今年）</h2>
          <div className="chart-grid">
            {monthlySalesPoints.map((point) => (
              <div key={point.month} className="chart-col">
                <div className="chart-track">
                  <span style={{ height: `${Math.max((point.amount / monthlyPeak) * 100, 2)}%` }} className="chart-bar" />
                </div>
                <p className="chart-label">{point.month}</p>
                <p className="chart-value">{yen(point.amount)}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>資金/回収の健全性</h2>
          <div className="items-box">
            <p className="item-row">売掛残（未回収）: {yen(overview?.receivable_balance ?? 0)}</p>
            <p className="item-row">買掛残（未払）: {yen(overview?.payable_balance ?? 0)}</p>
            <p className="item-row">全期間売上: {yen(overview?.all_time_sales ?? 0)}</p>
            <p className="item-row">期限超過請求: {overdueInvoices.length}件 / {yen(overdueAmount)}</p>
          </div>
          <div className="metric-block">
            <div className="metric-row">
              <span>請求回収率</span>
              <strong>{invoiceCollectionRate.toFixed(1)}%</strong>
            </div>
            <div className="status-track">
              <span style={{ width: `${invoiceCollectionRate}%` }} />
            </div>
          </div>
          <div className="metric-block">
            <div className="metric-row">
              <span>支払消込率</span>
              <strong>{paymentSettlementRate.toFixed(1)}%</strong>
            </div>
            <div className="status-track status-track-cyan">
              <span style={{ width: `${paymentSettlementRate}%` }} />
            </div>
          </div>
        </article>

        <article className="panel">
          <h2>要対応アラート</h2>
          <div className="items-box">
            {overdueInvoices.length === 0 ? <p className="item-row">期限超過の請求はありません</p> : null}
            {overdueInvoices.slice(0, 6).map(({ inv, due }) => (
              <p key={inv.invoice_id} className="item-row">
                {inv.invoice_id} / 案件 {inv.project_id} / 期日 {due ? ymd(due) : "-"} / 残 {yen(inv.remaining_amount)}
              </p>
            ))}
          </div>
          <Link href="/finance" className="inline-link">
            会計センターで対応する
          </Link>
        </article>
      </section>

      <section className="panel">
        <h2>稼働案件（どこが動いているか）</h2>
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
                    <span className="cell-sub">{project.project_name}</span>
                  </td>
                  <td>{project.customer_name}</td>
                  <td>{project.project_status}</td>
                  <td>{yen(project.invoice_total_amount)}</td>
                  <td>{yen(project.payment_total_amount)}</td>
                  <td>{yen(project.gross_estimate)}</td>
                  <td>
                    <Link href={`/projects/${project.project_id}`} className="inline-link">
                      案件を開く
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {message ? <p className="message">{message}</p> : null}
    </main>
  );
}
