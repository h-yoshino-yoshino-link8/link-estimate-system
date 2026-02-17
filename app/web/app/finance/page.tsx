"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  downloadBlob,
  exportReceipt,
  getInvoices,
  getPayments,
  getProjects,
  updateInvoice,
  updatePayment,
  type Invoice,
  type Payment,
  type Project,
} from "../../lib/api";

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

export default function FinanceCenterPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState("all");

  const [invoiceToUpdate, setInvoiceToUpdate] = useState("");
  const [invoicePaidToUpdate, setInvoicePaidToUpdate] = useState("0");
  const [paymentToUpdate, setPaymentToUpdate] = useState("");
  const [paymentPaidToUpdate, setPaymentPaidToUpdate] = useState("0");
  const [invoiceIdForReceipt, setInvoiceIdForReceipt] = useState("");

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((p) => map.set(p.project_id, p));
    return map;
  }, [projects]);

  const filteredInvoices = useMemo(() => {
    if (selectedProjectId === "all") return invoices;
    return invoices.filter((x) => x.project_id === selectedProjectId);
  }, [invoices, selectedProjectId]);

  const filteredPayments = useMemo(() => {
    if (selectedProjectId === "all") return payments;
    return payments.filter((x) => x.project_id === selectedProjectId);
  }, [payments, selectedProjectId]);

  const overdueInvoices = useMemo(() => {
    const today = new Date();
    return filteredInvoices
      .filter((inv) => inv.remaining_amount > 0)
      .map((inv) => {
        const billed = asDate(inv.billed_at);
        const due = billed ? addDays(billed, 30) : null;
        return { inv, due };
      })
      .filter((x) => x.due && x.due < today)
      .sort((a, b) => (a.due && b.due ? a.due.getTime() - b.due.getTime() : 0));
  }, [filteredInvoices]);

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const [projectData, invoiceData, paymentData] = await Promise.all([getProjects(), getInvoices(), getPayments()]);
      setProjects(projectData.items);
      setInvoices(invoiceData);
      setPayments(paymentData);

      const firstInvoice = invoiceData[0];
      setInvoiceToUpdate(firstInvoice?.invoice_id ?? "");
      setInvoicePaidToUpdate(firstInvoice ? String(firstInvoice.paid_amount) : "0");
      setInvoiceIdForReceipt(firstInvoice?.invoice_id ?? "");

      const firstPayment = paymentData[0];
      setPaymentToUpdate(firstPayment?.payment_id ?? "");
      setPaymentPaidToUpdate(firstPayment ? String(firstPayment.paid_amount) : "0");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "会計データ取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onUpdateInvoice = async () => {
    if (!invoiceToUpdate) {
      setMessage("更新対象の請求IDを選択してください");
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      const updated = await updateInvoice(invoiceToUpdate, {
        paid_amount: Number(invoicePaidToUpdate || "0"),
      });
      await load();
      setInvoiceIdForReceipt(updated.invoice_id);
      setMessage(`請求を更新しました: ${updated.invoice_id} / ${updated.status}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "請求更新に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  const onUpdatePayment = async () => {
    if (!paymentToUpdate) {
      setMessage("更新対象の支払IDを選択してください");
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      const updated = await updatePayment(paymentToUpdate, {
        paid_amount: Number(paymentPaidToUpdate || "0"),
      });
      await load();
      setMessage(`支払を更新しました: ${updated.payment_id} / ${updated.status}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "支払更新に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  const onExportReceipt = async () => {
    if (!invoiceIdForReceipt) {
      setMessage("領収書対象の請求IDを選択してください");
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      const { blob } = await exportReceipt(invoiceIdForReceipt);
      downloadBlob(blob, `receipt_${invoiceIdForReceipt}.pdf`);
      setMessage(`領収書PDFを出力しました: ${invoiceIdForReceipt}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "領収書PDF出力に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  const onDraftReminderMail = () => {
    const target = invoices.find((x) => x.invoice_id === invoiceIdForReceipt);
    if (!target) {
      setMessage("請求データがありません");
      return;
    }

    const dueDate = target.billed_at ? addDays(new Date(target.billed_at), 30) : null;
    const subject = encodeURIComponent(`【ご確認】請求 ${target.invoice_id} のお支払いについて`);
    const body = encodeURIComponent([
      `${projectMap.get(target.project_id)?.customer_name ?? "お客様"} 様`,
      "",
      `案件ID: ${target.project_id}`,
      `請求ID: ${target.invoice_id}`,
      `未入金残額: ${yen(target.remaining_amount)}`,
      `お支払期限(目安): ${dueDate ? ymd(dueDate) : "未設定"}`,
      "",
      "お忙しいところ恐れ入りますが、ご確認のほどお願いいたします。",
    ].join("\n"));

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setMessage("督促メール文面を生成しました（メーラーが開きます）");
  };

  const totalReceivable = useMemo(
    () => filteredInvoices.reduce((sum, row) => sum + Number(row.remaining_amount || 0), 0),
    [filteredInvoices],
  );
  const totalPayable = useMemo(
    () => filteredPayments.reduce((sum, row) => sum + Number(row.remaining_amount || 0), 0),
    [filteredPayments],
  );

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Finance Center</p>
        <h1>請求・入金・支払センター</h1>
        <p className="sub">全案件を横断して、未入金・期限超過・消込更新・帳票出力をまとめて処理します。</p>
        <div className="hero-actions">
          <label className="inline-control">
            対象案件
            <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} disabled={working || loading}>
              <option value="all">全案件</option>
              {projects.map((project) => (
                <option key={project.project_id} value={project.project_id}>
                  {project.project_id} / {project.project_name}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => void load()} disabled={working || loading}>
            最新に更新
          </button>
        </div>
      </section>

      <section className="overview-grid compact">
        <article className="mini-kpi">
          <p className="mini-label">未回収（売掛）</p>
          <p className="mini-value">{yen(totalReceivable)}</p>
        </article>
        <article className="mini-kpi">
          <p className="mini-label">未払（買掛）</p>
          <p className="mini-value">{yen(totalPayable)}</p>
        </article>
        <article className="mini-kpi">
          <p className="mini-label">期限超過請求</p>
          <p className="mini-value">{overdueInvoices.length}件</p>
        </article>
        <article className="mini-kpi">
          <p className="mini-label">期限超過金額</p>
          <p className="mini-value">{yen(overdueInvoices.reduce((sum, x) => sum + x.inv.remaining_amount, 0))}</p>
        </article>
      </section>

      <section className="workspace-grid">
        <article className="panel">
          <h2>請求消込更新</h2>
          <label>
            請求ID
            <select
              value={invoiceToUpdate}
              onChange={(e) => {
                setInvoiceToUpdate(e.target.value);
                const inv = invoices.find((x) => x.invoice_id === e.target.value);
                if (inv) setInvoicePaidToUpdate(String(inv.paid_amount));
              }}
              disabled={working}
            >
              {invoices.length === 0 ? <option value="">請求データなし</option> : null}
              {invoices.map((inv) => (
                <option key={inv.invoice_id} value={inv.invoice_id}>
                  {inv.invoice_id} / {inv.project_id} / 残{yen(inv.remaining_amount)}
                </option>
              ))}
            </select>
          </label>
          <label>
            更新後入金額
            <input value={invoicePaidToUpdate} onChange={(e) => setInvoicePaidToUpdate(e.target.value)} />
          </label>
          <button onClick={onUpdateInvoice} disabled={working || !invoiceToUpdate}>
            請求を更新
          </button>
        </article>

        <article className="panel">
          <h2>支払消込更新</h2>
          <label>
            支払ID
            <select
              value={paymentToUpdate}
              onChange={(e) => {
                setPaymentToUpdate(e.target.value);
                const pay = payments.find((x) => x.payment_id === e.target.value);
                if (pay) setPaymentPaidToUpdate(String(pay.paid_amount));
              }}
              disabled={working}
            >
              {payments.length === 0 ? <option value="">支払データなし</option> : null}
              {payments.map((pay) => (
                <option key={pay.payment_id} value={pay.payment_id}>
                  {pay.payment_id} / {pay.project_id} / 残{yen(pay.remaining_amount)}
                </option>
              ))}
            </select>
          </label>
          <label>
            更新後支払額
            <input value={paymentPaidToUpdate} onChange={(e) => setPaymentPaidToUpdate(e.target.value)} />
          </label>
          <button onClick={onUpdatePayment} disabled={working || !paymentToUpdate}>
            支払を更新
          </button>
        </article>

        <article className="panel">
          <h2>領収書・督促メール</h2>
          <label>
            対象請求ID
            <select value={invoiceIdForReceipt} onChange={(e) => setInvoiceIdForReceipt(e.target.value)} disabled={working}>
              {invoices.length === 0 ? <option value="">請求データなし</option> : null}
              {invoices.map((inv) => (
                <option key={inv.invoice_id} value={inv.invoice_id}>
                  {inv.invoice_id} / {inv.project_id} / 未入金 {yen(inv.remaining_amount)}
                </option>
              ))}
            </select>
          </label>
          <button onClick={onExportReceipt} disabled={working || !invoiceIdForReceipt}>
            領収書PDFを出力
          </button>
          <button onClick={onDraftReminderMail} disabled={working || !invoiceIdForReceipt}>
            督促メール文面を作成
          </button>
          <p className="item-row">実メール送信はメーラー連携（mailto）で対応しています。</p>
        </article>
      </section>

      <section className="panel">
        <h2>未入金/期限管理一覧</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>請求ID</th>
                <th>案件</th>
                <th>顧客</th>
                <th>請求日</th>
                <th>期限(請求日+30日)</th>
                <th>残額</th>
                <th>状態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices
                .filter((inv) => inv.remaining_amount > 0)
                .map((inv) => {
                  const billed = asDate(inv.billed_at);
                  const due = billed ? addDays(billed, 30) : null;
                  const isOverdue = due ? due < new Date() : false;
                  return (
                    <tr key={inv.invoice_id} className={isOverdue ? "row-alert" : ""}>
                      <td>{inv.invoice_id}</td>
                      <td>
                        <Link href={`/projects/${inv.project_id}`} className="inline-link">
                          {inv.project_id}
                        </Link>
                      </td>
                      <td>{projectMap.get(inv.project_id)?.customer_name ?? "-"}</td>
                      <td>{inv.billed_at ?? "-"}</td>
                      <td>{due ? ymd(due) : "-"}</td>
                      <td>{yen(inv.remaining_amount)}</td>
                      <td>{isOverdue ? "期限超過" : "未回収"}</td>
                      <td>
                        <button
                          className="table-btn"
                          onClick={() => {
                            setInvoiceToUpdate(inv.invoice_id);
                            setInvoicePaidToUpdate(String(inv.paid_amount));
                            setInvoiceIdForReceipt(inv.invoice_id);
                          }}
                        >
                          この請求を処理
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      {message ? <p className="message">{message}</p> : null}
    </main>
  );
}
