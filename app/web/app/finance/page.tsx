"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getInvoices, getProjects, type Invoice, type Project } from "../../lib/api";

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

export default function FinancePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [projectRows, invoiceRows] = await Promise.all([getProjects(), getInvoices()]);
        setProjects(projectRows.items);
        setInvoices(invoiceRows);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "データ取得に失敗しました");
      }
    })();
  }, []);

  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p) => map.set(p.project_id, p.project_name));
    return map;
  }, [projects]);

  const overdueInvoices = useMemo(() => {
    const today = new Date();
    return invoices
      .filter((inv) => inv.remaining_amount > 0)
      .map((inv) => {
        const billed = asDate(inv.billed_at);
        const dueDate = billed ? addDays(billed, 30) : null;
        return { inv, dueDate };
      })
      .filter((x) => x.dueDate && x.dueDate < today)
      .sort((a, b) => (a.dueDate && b.dueDate ? a.dueDate.getTime() - b.dueDate.getTime() : 0));
  }, [invoices]);

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Integrated Flow</p>
        <h1>会計処理は案件ワークスペースに統合しました</h1>
        <p className="sub">
          請求・入金・支払・領収書・メール文面は、各案件の画面で完結します。ここは旧導線の互換ページです。
        </p>
        <div className="hero-actions">
          <Link href="/projects" className="link-btn">
            案件一覧へ
          </Link>
        </div>
      </section>

      <section className="panel">
        <h2>期限超過の請求（参照のみ）</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>請求ID</th>
                <th>案件ID</th>
                <th>案件名</th>
                <th>期日</th>
                <th>残額</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {overdueInvoices.map(({ inv, dueDate }) => (
                <tr key={inv.invoice_id} className="row-alert">
                  <td>{inv.invoice_id}</td>
                  <td>{inv.project_id}</td>
                  <td>{projectNameMap.get(inv.project_id) ?? "-"}</td>
                  <td>{dueDate ? ymd(dueDate) : "-"}</td>
                  <td>{yen(inv.remaining_amount)}</td>
                  <td>
                    <Link href={`/projects/${inv.project_id}`} className="inline-link">
                      案件を開く
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {overdueInvoices.length === 0 ? <p className="item-row">期限超過の請求はありません。</p> : null}
      </section>

      {message ? <p className="message">{message}</p> : null}
    </main>
  );
}
