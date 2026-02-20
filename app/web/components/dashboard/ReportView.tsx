"use client";

import { useEffect, useState, useMemo } from "react";
import {
  getInvoicesWithProjects,
  getPaymentsWithProjects,
  type InvoiceWithProject,
  type PaymentWithProject,
} from "../../lib/api";
import { exportInvoicesCSV, exportPaymentsCSV } from "../../lib/csv-export";

function yen(n: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "\u00a50";
  return `\u00a5${Math.round(v).toLocaleString()}`;
}

function invoiceStatusBadge(status: string) {
  if (status === "未請求") return "badge badge-default";
  if (status === "請求済") return "badge badge-blue";
  if (status === "一部入金") return "badge badge-warning";
  if (status === "入金済") return "badge badge-success";
  return "badge badge-default";
}

function paymentStatusBadge(status: string) {
  if (status === "未発注") return "badge badge-default";
  if (status === "発注済") return "badge badge-blue";
  if (status === "一部支払") return "badge badge-warning";
  if (status === "支払済") return "badge badge-success";
  return "badge badge-default";
}

type PeriodType = "monthly" | "quarterly" | "yearly";

export default function ReportView() {
  const now = new Date();
  const [period, setPeriod] = useState<PeriodType>("monthly");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [invoices, setInvoices] = useState<InvoiceWithProject[]>([]);
  const [payments, setPayments] = useState<PaymentWithProject[]>([]);
  const [loading, setLoading] = useState(true);

  const { from, to } = useMemo(() => {
    if (period === "monthly") {
      const lastDay = new Date(year, month, 0).getDate();
      return {
        from: `${year}-${String(month).padStart(2, "0")}-01`,
        to: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      };
    }
    if (period === "quarterly") {
      const qStart = Math.floor((month - 1) / 3) * 3 + 1;
      const qEnd = qStart + 2;
      const lastDay = new Date(year, qEnd, 0).getDate();
      return {
        from: `${year}-${String(qStart).padStart(2, "0")}-01`,
        to: `${year}-${String(qEnd).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      };
    }
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }, [period, year, month]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getInvoicesWithProjects({ from, to }),
      getPaymentsWithProjects({ from, to }),
    ]).then(([invs, pays]) => {
      if (!cancelled) {
        setInvoices(invs);
        setPayments(pays);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [from, to]);

  const totalSales = useMemo(() => invoices.reduce((s, inv) => s + inv.invoice_amount, 0), [invoices]);
  const totalPayments = useMemo(() => payments.reduce((s, pay) => s + pay.ordered_amount, 0), [payments]);
  const grossProfit = totalSales - totalPayments;

  return (
    <div>
      {/* Period Selector */}
      <div className="report-controls">
        <select value={period} onChange={(e) => setPeriod(e.target.value as PeriodType)}>
          <option value="monthly">月次</option>
          <option value="quarterly">四半期</option>
          <option value="yearly">年次</option>
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[2024, 2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>{y}年</option>
          ))}
        </select>
        {period !== "yearly" && (
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
        )}
        <span className="report-period-label">{from} ~ {to}</span>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="kpi-card">
          <p className="kpi-label">売上（請求額合計）</p>
          <p className="kpi-value">{yen(totalSales)}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">支払（発注額合計）</p>
          <p className="kpi-value">{yen(totalPayments)}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">粗利（売上 − 外注費）</p>
          <p className={`kpi-value ${grossProfit >= 0 ? "is-positive" : "is-negative"}`}>
            {yen(grossProfit)}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--c-text-4)" }}>
          読み込み中...
        </div>
      ) : (
        <>
          {/* Invoices Section */}
          <div className="report-section">
            <div className="report-section-header">
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text-2)" }}>
                請求一覧（{invoices.length}件）
              </span>
              <button
                className="btn btn-sm"
                onClick={() => exportInvoicesCSV(invoices)}
                disabled={invoices.length === 0}
              >
                CSV出力
              </button>
            </div>
            {invoices.length === 0 ? (
              <div className="empty-state">この期間の請求データはありません</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>案件名</th>
                      <th>顧客名</th>
                      <th className="text-right">請求額</th>
                      <th className="text-right">入金済</th>
                      <th className="text-right">残額</th>
                      <th>請求日</th>
                      <th>支払期限</th>
                      <th>ステータス</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.invoice_id}>
                        <td style={{ fontWeight: 500 }}>{inv.project_name}</td>
                        <td>{inv.customer_name}</td>
                        <td className="text-right">{yen(inv.invoice_amount)}</td>
                        <td className="text-right">{yen(inv.paid_amount)}</td>
                        <td className="text-right" style={{ fontWeight: 600 }}>{yen(inv.remaining_amount)}</td>
                        <td style={{ fontSize: 12, color: "var(--c-text-3)" }}>{inv.billed_at}</td>
                        <td style={{ fontSize: 12, color: "var(--c-text-3)" }}>{inv.due_date}</td>
                        <td><span className={invoiceStatusBadge(inv.status)}>{inv.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payments Section */}
          <div className="report-section">
            <div className="report-section-header">
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text-2)" }}>
                支払一覧（{payments.length}件）
              </span>
              <button
                className="btn btn-sm"
                onClick={() => exportPaymentsCSV(payments)}
                disabled={payments.length === 0}
              >
                CSV出力
              </button>
            </div>
            {payments.length === 0 ? (
              <div className="empty-state">この期間の支払データはありません</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>案件名</th>
                      <th>仕入先</th>
                      <th>工事内容</th>
                      <th className="text-right">発注額</th>
                      <th className="text-right">支払済</th>
                      <th className="text-right">残額</th>
                      <th>ステータス</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((pay) => (
                      <tr key={pay.payment_id}>
                        <td style={{ fontWeight: 500 }}>{pay.project_name}</td>
                        <td>{pay.vendor_name}</td>
                        <td style={{ fontSize: 12, color: "var(--c-text-3)" }}>{pay.work_description ?? "-"}</td>
                        <td className="text-right">{yen(pay.ordered_amount)}</td>
                        <td className="text-right">{yen(pay.paid_amount)}</td>
                        <td className="text-right" style={{ fontWeight: 600 }}>{yen(pay.remaining_amount)}</td>
                        <td><span className={paymentStatusBadge(pay.status)}>{pay.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
