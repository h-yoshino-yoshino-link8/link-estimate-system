"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getProject, getProjectItems, getWorkItems, getInvoices, getPayments, getVendors,
  createProjectItem, updateProjectItem, deleteProjectItem,
  createInvoice, updateInvoice,
  createPayment, updatePayment,
  updateProjectStatus, exportEstimate, downloadBlob,
  itemCostTotal, itemSellingTotal, itemMargin, marginRate,
  PROJECT_STATUSES,
  type Project, type ProjectItem, type WorkItemMaster, type Invoice, type Payment, type Vendor,
} from "../../../lib/api";

function yen(value: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "¥0";
  return `¥${Math.round(n).toLocaleString()}`;
}

function pct(value: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.0%";
  return `${n.toFixed(1)}%`;
}

function safeNum(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

type Tab = "estimate" | "invoice" | "payment";

export default function ProjectCockpitPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [workItems, setWorkItems] = useState<WorkItemMaster[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<Tab>("estimate");

  // Add item form
  const [selectedMasterId, setSelectedMasterId] = useState<number | "">("");
  const [addQty, setAddQty] = useState("1");
  const [addCost, setAddCost] = useState("");
  const [addSelling, setAddSelling] = useState("");
  const [adding, setAdding] = useState(false);

  // Invoice form
  const [invAmount, setInvAmount] = useState("");
  const [invCreating, setInvCreating] = useState(false);

  // Payment form
  const [payVendor, setPayVendor] = useState("");
  const [payDesc, setPayDesc] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payCreating, setPayCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const [proj, itemRows, wiRows, invRows, payRows, vendorRows] = await Promise.all([
        getProject(projectId),
        getProjectItems(projectId),
        getWorkItems(),
        getInvoices(projectId),
        getPayments(projectId),
        getVendors(),
      ]);
      setProject(proj);
      setItems(itemRows);
      setWorkItems(wiRows);
      setInvoices(invRows);
      setPayments(payRows);
      setVendors(vendorRows);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "データ取得失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [projectId]);

  // When master item changes, auto-fill cost/selling
  useEffect(() => {
    if (selectedMasterId === "") return;
    const master = workItems.find((x) => x.id === Number(selectedMasterId));
    if (master) {
      setAddCost(String(master.cost_price));
      setAddSelling(String(master.selling_price));
    }
  }, [selectedMasterId, workItems]);

  // Totals
  const totalCost = useMemo(() => items.reduce((s, x) => s + itemCostTotal(x), 0), [items]);
  const totalSelling = useMemo(() => items.reduce((s, x) => s + itemSellingTotal(x), 0), [items]);
  const totalMargin = totalSelling - totalCost;
  const totalMarginRate = marginRate(totalSelling, totalCost);

  const invoiceTotal = useMemo(() => invoices.reduce((s, x) => s + safeNum(x.invoice_amount), 0), [invoices]);
  const invoicePaid = useMemo(() => invoices.reduce((s, x) => s + safeNum(x.paid_amount), 0), [invoices]);
  const paymentTotal = useMemo(() => payments.reduce((s, x) => s + safeNum(x.ordered_amount), 0), [payments]);
  const paymentPaid = useMemo(() => payments.reduce((s, x) => s + safeNum(x.paid_amount), 0), [payments]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups = new Map<string, ProjectItem[]>();
    for (const item of items) {
      const cat = item.category || "その他";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(item);
    }
    return groups;
  }, [items]);

  const handleAddItem = async () => {
    if (selectedMasterId === "") { setMessage("工事項目を選択してください"); return; }
    setAdding(true);
    setMessage("");
    try {
      await createProjectItem(projectId, {
        master_item_id: Number(selectedMasterId),
        quantity: safeNum(addQty) || 1,
        cost_price: addCost ? safeNum(addCost) : undefined,
        selling_price: addSelling ? safeNum(addSelling) : undefined,
      });
      setSelectedMasterId("");
      setAddQty("1");
      setAddCost("");
      setAddSelling("");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "追加失敗");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!confirm("この明細を削除しますか？")) return;
    try {
      await deleteProjectItem(projectId, itemId);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "削除失敗");
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await updateProjectStatus(projectId, status);
      await load();
      setMessage(`ステータスを「${status}」に変更しました`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "ステータス変更失敗");
    }
  };

  const handleCreateInvoice = async () => {
    const amount = safeNum(invAmount);
    if (amount <= 0) { setMessage("請求金額を入力してください"); return; }
    setInvCreating(true);
    try {
      await createInvoice({ project_id: projectId, invoice_amount: amount });
      setInvAmount("");
      await load();
      setMessage("請求を登録しました");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "請求登録失敗");
    } finally {
      setInvCreating(false);
    }
  };

  const handleInvoicePayment = async (invoiceId: string, amount: number) => {
    const input = prompt("入金額を入力", String(amount));
    if (input === null) return;
    try {
      await updateInvoice(invoiceId, { paid_amount: safeNum(input) });
      await load();
      setMessage("入金を記録しました");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "入金記録失敗");
    }
  };

  const handleCreatePayment = async () => {
    const amount = safeNum(payAmount);
    if (amount <= 0 || !payVendor.trim()) { setMessage("仕入先と発注金額は必須です"); return; }
    setPayCreating(true);
    try {
      await createPayment({
        project_id: projectId,
        vendor_name: payVendor.trim(),
        work_description: payDesc.trim() || undefined,
        ordered_amount: amount,
      });
      setPayVendor("");
      setPayDesc("");
      setPayAmount("");
      await load();
      setMessage("支払を登録しました");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "支払登録失敗");
    } finally {
      setPayCreating(false);
    }
  };

  const handlePaymentRecord = async (paymentId: string, ordered: number) => {
    const input = prompt("支払額を入力", String(ordered));
    if (input === null) return;
    try {
      await updatePayment(paymentId, { paid_amount: safeNum(input) });
      await load();
      setMessage("支払を記録しました");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "支払記録失敗");
    }
  };

  const handleExportPdf = async () => {
    try {
      const { blob } = await exportEstimate(projectId);
      downloadBlob(blob, `estimate_${projectId}.pdf`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "PDF出力失敗");
    }
  };

  if (loading && !project) {
    return <main className="page"><p style={{ textAlign: "center", padding: 40, color: "var(--c-text-4)" }}>読み込み中...</p></main>;
  }

  return (
    <main className="page">
      {/* Header */}
      <div className="cockpit-header">
        <div className="cockpit-meta">
          <h1>{project?.project_name ?? projectId}</h1>
          <p>
            <span className="text-mono">{projectId}</span>
            {" / "}
            {project?.customer_name}
            {project?.site_address && <> / {project.site_address}</>}
          </p>
        </div>
        <div className="cockpit-actions">
          <button className="btn" onClick={handleExportPdf}>PDF出力</button>
          <Link href="/projects" className="btn" style={{ textDecoration: "none" }}>一覧に戻る</Link>
        </div>
      </div>

      {/* Status + KPIs */}
      <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-3)" }}>ステータス:</span>
        {PROJECT_STATUSES.filter((s) => s !== "失注").map((s) => (
          <button
            key={s}
            className={`status-chip ${project?.project_status === s ? "is-active" : ""}`}
            onClick={() => void handleStatusChange(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mini-kpi-row">
        <div className="mini-kpi">
          <div className="mini-label">売値合計</div>
          <div className="mini-value">{yen(totalSelling)}</div>
        </div>
        <div className="mini-kpi">
          <div className="mini-label">原価合計</div>
          <div className="mini-value">{yen(totalCost)}</div>
        </div>
        <div className="mini-kpi">
          <div className="mini-label">粗利</div>
          <div className={`mini-value ${totalMargin >= 0 ? "is-positive" : ""}`}>{yen(totalMargin)}</div>
        </div>
        <div className="mini-kpi">
          <div className="mini-label">粗利率</div>
          <div className={`mini-value ${totalMarginRate >= 30 ? "is-positive" : ""}`}>{pct(totalMarginRate)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-row">
        <button className={`tab-btn ${tab === "estimate" ? "is-active" : ""}`} onClick={() => setTab("estimate")}>
          見積明細（{items.length}）
        </button>
        <button className={`tab-btn ${tab === "invoice" ? "is-active" : ""}`} onClick={() => setTab("invoice")}>
          請求（{invoices.length}）
        </button>
        <button className={`tab-btn ${tab === "payment" ? "is-active" : ""}`} onClick={() => setTab("payment")}>
          支払（{payments.length}）
        </button>
      </div>

      {/* Estimate Tab */}
      {tab === "estimate" && (
        <div className="card">
          {/* Add item form */}
          <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "var(--sp-4)" }}>
            <label style={{ flex: "1 1 200px" }}>
              工事項目
              <select value={selectedMasterId} onChange={(e) => setSelectedMasterId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">マスタから選択</option>
                {workItems.map((wi) => (
                  <option key={wi.id} value={wi.id}>
                    [{wi.category}] {wi.item_name} （原価¥{wi.cost_price.toLocaleString()} → 売値¥{wi.selling_price.toLocaleString()}）
                  </option>
                ))}
              </select>
            </label>
            <label style={{ width: 70 }}>
              数量
              <input type="number" value={addQty} onChange={(e) => setAddQty(e.target.value)} min="1" />
            </label>
            <label style={{ width: 100 }}>
              原価
              <input type="number" value={addCost} onChange={(e) => setAddCost(e.target.value)} placeholder="自動" />
            </label>
            <label style={{ width: 100 }}>
              売値
              <input type="number" value={addSelling} onChange={(e) => setAddSelling(e.target.value)} placeholder="自動" />
            </label>
            <button className="btn btn-primary" onClick={() => void handleAddItem()} disabled={adding}>
              {adding ? "追加中..." : "追加"}
            </button>
          </div>

          {/* Items table */}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>カテゴリ</th>
                  <th>項目名</th>
                  <th>単位</th>
                  <th className="text-right">数量</th>
                  <th className="text-right">原価単価</th>
                  <th className="text-right">売値単価</th>
                  <th className="text-right">原価小計</th>
                  <th className="text-right">売値小計</th>
                  <th className="text-right">粗利</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr className="empty-row"><td colSpan={10}>明細がありません。上のフォームから追加してください。</td></tr>
                ) : (
                  <>
                    {Array.from(groupedItems.entries()).map(([cat, catItems]) => {
                      const catCost = catItems.reduce((s, x) => s + itemCostTotal(x), 0);
                      const catSelling = catItems.reduce((s, x) => s + itemSellingTotal(x), 0);
                      return (
                        <React.Fragment key={cat}>
                          {catItems.map((item) => (
                            <tr key={item.id}>
                              <td style={{ fontSize: 11, color: "var(--c-text-3)" }}>{item.category}</td>
                              <td style={{ fontWeight: 500 }}>{item.item_name}</td>
                              <td>{item.unit}</td>
                              <td className="text-right">{item.quantity}</td>
                              <td className="text-right">{yen(item.cost_price)}</td>
                              <td className="text-right">{yen(item.selling_price)}</td>
                              <td className="text-right">{yen(itemCostTotal(item))}</td>
                              <td className="text-right">{yen(itemSellingTotal(item))}</td>
                              <td className="text-right" style={{ fontWeight: 600, color: itemMargin(item) >= 0 ? "var(--c-success)" : "var(--c-error)" }}>
                                {yen(itemMargin(item))}
                              </td>
                              <td>
                                <button className="btn btn-sm btn-danger" onClick={() => void handleDeleteItem(item.id)}>削除</button>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                    <tr className="table-total-row">
                      <td colSpan={6} style={{ fontWeight: 700 }}>合計</td>
                      <td className="text-right">{yen(totalCost)}</td>
                      <td className="text-right">{yen(totalSelling)}</td>
                      <td className="text-right">{yen(totalMargin)} ({pct(totalMarginRate)})</td>
                      <td></td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Tab */}
      {tab === "invoice" && (
        <div className="card">
          <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "flex-end", marginBottom: "var(--sp-4)" }}>
            <label style={{ flex: "0 0 200px" }}>
              請求金額
              <input
                type="number"
                value={invAmount}
                onChange={(e) => setInvAmount(e.target.value)}
                placeholder={String(Math.round(totalSelling))}
              />
            </label>
            <button className="btn btn-primary" onClick={() => void handleCreateInvoice()} disabled={invCreating}>
              {invCreating ? "登録中..." : "請求登録"}
            </button>
            {totalSelling > 0 && (
              <button className="btn" onClick={() => setInvAmount(String(Math.round(totalSelling)))}>
                売値合計を反映
              </button>
            )}
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>請求ID</th>
                  <th>請求日</th>
                  <th>支払期限</th>
                  <th className="text-right">請求額</th>
                  <th className="text-right">入金済</th>
                  <th className="text-right">残額</th>
                  <th>状態</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr className="empty-row"><td colSpan={8}>請求データはありません</td></tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.invoice_id}>
                      <td className="text-mono">{inv.invoice_id}</td>
                      <td>{inv.billed_at}</td>
                      <td>{inv.due_date}</td>
                      <td className="text-right">{yen(inv.invoice_amount)}</td>
                      <td className="text-right">{yen(inv.paid_amount)}</td>
                      <td className="text-right" style={{ fontWeight: 600 }}>{yen(inv.remaining_amount)}</td>
                      <td>
                        <span className={`badge ${inv.status === "入金済" ? "badge-success" : inv.status === "一部入金" ? "badge-warning" : "badge-error"}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td>
                        {inv.remaining_amount > 0 && (
                          <button className="btn btn-sm btn-success" onClick={() => void handleInvoicePayment(inv.invoice_id, inv.invoice_amount)}>
                            入金記録
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
                {invoices.length > 0 && (
                  <tr className="table-total-row">
                    <td colSpan={3} style={{ fontWeight: 700 }}>合計</td>
                    <td className="text-right">{yen(invoiceTotal)}</td>
                    <td className="text-right">{yen(invoicePaid)}</td>
                    <td className="text-right">{yen(invoiceTotal - invoicePaid)}</td>
                    <td colSpan={2}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Tab */}
      {tab === "payment" && (
        <div className="card">
          <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "var(--sp-4)" }}>
            <label style={{ flex: "1 1 150px" }}>
              仕入先
              <input value={payVendor} onChange={(e) => setPayVendor(e.target.value)} placeholder="例: M-Pros" list="vendor-list" />
              <datalist id="vendor-list">
                {vendors.map((v) => <option key={v.vendor_id} value={v.vendor_name} />)}
              </datalist>
            </label>
            <label style={{ flex: "1 1 150px" }}>
              工事内容
              <input value={payDesc} onChange={(e) => setPayDesc(e.target.value)} placeholder="例: クロス施工" />
            </label>
            <label style={{ width: 150 }}>
              発注金額
              <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </label>
            <button className="btn btn-primary" onClick={() => void handleCreatePayment()} disabled={payCreating}>
              {payCreating ? "登録中..." : "支払登録"}
            </button>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>支払ID</th>
                  <th>仕入先</th>
                  <th>工事内容</th>
                  <th className="text-right">発注額</th>
                  <th className="text-right">支払済</th>
                  <th className="text-right">残額</th>
                  <th>状態</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr className="empty-row"><td colSpan={8}>支払データはありません</td></tr>
                ) : (
                  payments.map((pay) => (
                    <tr key={pay.payment_id}>
                      <td className="text-mono">{pay.payment_id}</td>
                      <td style={{ fontWeight: 500 }}>{pay.vendor_name}</td>
                      <td style={{ fontSize: 12, color: "var(--c-text-3)" }}>{pay.work_description ?? "-"}</td>
                      <td className="text-right">{yen(pay.ordered_amount)}</td>
                      <td className="text-right">{yen(pay.paid_amount)}</td>
                      <td className="text-right" style={{ fontWeight: 600 }}>{yen(pay.remaining_amount)}</td>
                      <td>
                        <span className={`badge ${pay.status === "支払済" ? "badge-success" : pay.status === "一部支払" ? "badge-warning" : "badge-error"}`}>
                          {pay.status}
                        </span>
                      </td>
                      <td>
                        {pay.remaining_amount > 0 && (
                          <button className="btn btn-sm btn-success" onClick={() => void handlePaymentRecord(pay.payment_id, pay.ordered_amount)}>
                            支払記録
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
                {payments.length > 0 && (
                  <tr className="table-total-row">
                    <td colSpan={3} style={{ fontWeight: 700 }}>合計</td>
                    <td className="text-right">{yen(paymentTotal)}</td>
                    <td className="text-right">{yen(paymentPaid)}</td>
                    <td className="text-right">{yen(paymentTotal - paymentPaid)}</td>
                    <td colSpan={2}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {message && (
        <p className={`message ${message.includes("失敗") || message.includes("必須") ? "message-error" : "message-success"}`}>
          {message}
        </p>
      )}
    </main>
  );
}
