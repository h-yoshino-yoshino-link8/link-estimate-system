"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getProject, getProjectItems, getWorkItems, getInvoices, getPayments, getVendors,
  createProjectItem, updateProjectItem, deleteProjectItem, reorderProjectItems,
  createInvoice, updateInvoice,
  createPayment, updatePayment,
  updateProjectStatus, exportEstimateHtml,
  addTemplateToProject, getEstimateTemplates,
  getStaffMembers, updateProjectStaff,
  itemCostTotal, itemSellingTotal, itemMargin, marginRate,
  PROJECT_STATUSES,
  type Project, type ProjectItem, type WorkItemMaster, type Invoice, type Payment, type Vendor,
  type EstimateTemplate, type StaffMember,
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

function mrClass(rate: number) {
  if (rate >= 30) return "margin-rate is-good";
  if (rate >= 20) return "margin-rate is-ok";
  return "margin-rate is-low";
}

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

  // Add item form (search-based)
  const [searchText, setSearchText] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedMaster, setSelectedMaster] = useState<WorkItemMaster | null>(null);
  const [isCustomItem, setIsCustomItem] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [customUnit, setCustomUnit] = useState("式");
  const [addQty, setAddQty] = useState("1");
  const [addCost, setAddCost] = useState("");
  const [addSelling, setAddSelling] = useState("");
  const [adding, setAdding] = useState(false);
  const [templates] = useState(() => getEstimateTemplates());

  // Inline edit
  const [editingCell, setEditingCell] = useState<{ itemId: number; field: 'quantity' | 'selling_price' | 'cost_price' } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Staff members for assignment
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  // PDF export staff name
  const [staffName, setStaffName] = useState("");

  // Drag & Drop state
  const [dragItemId, setDragItemId] = useState<number | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<number | null>(null);
  const [dragOverPos, setDragOverPos] = useState<"above" | "below" | null>(null);
  const dragCounterRef = useRef(0);

  // Amount input modal
  const [amountModal, setAmountModal] = useState<{
    type: "invoice" | "payment";
    id: string;
    defaultAmount: number;
    label: string;
  } | null>(null);
  const [modalAmount, setModalAmount] = useState("");

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
      const [proj, itemRows, wiRows, invRows, payRows, vendorRows, staffRows] = await Promise.all([
        getProject(projectId),
        getProjectItems(projectId),
        getWorkItems(),
        getInvoices(projectId),
        getPayments(projectId),
        getVendors(),
        getStaffMembers(),
      ]);
      setProject(proj);
      setItems(itemRows);
      setWorkItems(wiRows);
      setInvoices(invRows);
      setPayments(payRows);
      setVendors(vendorRows);
      setStaffList(staffRows);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "データ取得失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [projectId]);

  // Search suggestions
  const suggestions = useMemo(() => {
    const q = searchText.trim();
    if (!q) return { items: [] as WorkItemMaster[], templates: [] as EstimateTemplate[], showCustom: false };
    const ql = q.toLowerCase();
    const matchedItems = workItems.filter((wi) =>
      wi.item_name.toLowerCase().includes(ql) ||
      wi.category.toLowerCase().includes(ql)
    );
    const matchedTemplates = templates.filter((t) =>
      t.name.toLowerCase().includes(ql) ||
      t.description.toLowerCase().includes(ql) ||
      t.keywords.some((k) => k.toLowerCase().includes(ql))
    );
    return { items: matchedItems, templates: matchedTemplates, showCustom: q.length > 0 };
  }, [searchText, workItems, templates]);

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

  const handleSelectMaster = (wi: WorkItemMaster) => {
    setSelectedMaster(wi);
    setSearchText(wi.item_name);
    setAddCost(String(wi.cost_price));
    setAddSelling(String(wi.selling_price));
    setCustomUnit(wi.unit);
    setIsCustomItem(false);
    setShowSuggestions(false);
  };

  const handleSelectCustom = () => {
    setSelectedMaster(null);
    setIsCustomItem(true);
    setShowSuggestions(false);
  };

  const handleSelectTemplate = async (template: EstimateTemplate) => {
    setShowSuggestions(false);
    setSearchText("");
    setAdding(true);
    setMessage("");
    try {
      await addTemplateToProject(projectId, template.id);
      await load();
      setMessage(`テンプレート「${template.name}」から${template.items.length}項目を追加しました`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "テンプレート追加失敗");
    } finally {
      setAdding(false);
    }
  };

  const resetAddForm = () => {
    setSearchText("");
    setSelectedMaster(null);
    setIsCustomItem(false);
    setCustomCategory("");
    setCustomUnit("式");
    setAddQty("1");
    setAddCost("");
    setAddSelling("");
  };

  const handleAddItem = async () => {
    if (!selectedMaster && !searchText.trim()) {
      setMessage("項目名を入力してください");
      return;
    }
    setAdding(true);
    setMessage("");
    try {
      if (selectedMaster) {
        await createProjectItem(projectId, {
          master_item_id: selectedMaster.id,
          quantity: safeNum(addQty) || 1,
          cost_price: addCost ? safeNum(addCost) : undefined,
          selling_price: addSelling ? safeNum(addSelling) : undefined,
        });
      } else {
        await createProjectItem(projectId, {
          category: customCategory.trim() || "その他",
          item_name: searchText.trim(),
          unit: customUnit.trim() || "式",
          quantity: safeNum(addQty) || 1,
          cost_price: addCost ? safeNum(addCost) : 0,
          selling_price: addSelling ? safeNum(addSelling) : 0,
        });
      }
      resetAddForm();
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

  const startEditing = (item: ProjectItem, field: 'quantity' | 'selling_price' | 'cost_price') => {
    setEditingCell({ itemId: item.id, field });
    setEditValue(String(item[field]));
  };

  const commitEdit = async () => {
    if (!editingCell) return;
    const numVal = safeNum(editValue);
    try {
      await updateProjectItem(projectId, editingCell.itemId, { [editingCell.field]: numVal });
      setEditingCell(null);
      setEditValue("");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "更新失敗");
    }
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
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

  const handleInvoicePayment = (invoiceId: string, amount: number) => {
    setAmountModal({ type: "invoice", id: invoiceId, defaultAmount: amount, label: "入金額" });
    setModalAmount(String(amount));
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

  const handlePaymentRecord = (paymentId: string, ordered: number) => {
    setAmountModal({ type: "payment", id: paymentId, defaultAmount: ordered, label: "支払額" });
    setModalAmount(String(ordered));
  };

  const handleAmountConfirm = async () => {
    if (!amountModal) return;
    const amount = safeNum(modalAmount);
    if (amount <= 0) { setMessage("金額は1円以上で入力してください"); return; }
    try {
      if (amountModal.type === "invoice") {
        await updateInvoice(amountModal.id, { paid_amount: amount });
        setMessage("入金を記録しました");
      } else {
        await updatePayment(amountModal.id, { paid_amount: amount });
        setMessage("支払を記録しました");
      }
      setAmountModal(null);
      setModalAmount("");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "記録失敗");
    }
  };

  const handleExportPdf = async () => {
    try {
      const html = await exportEstimateHtml(projectId, { staffName });
      // html2pdf.jsでPDF直接ダウンロード
      const html2pdf = (await import("html2pdf.js")).default;
      const container = document.createElement("div");
      container.innerHTML = html;
      document.body.appendChild(container);
      const fileName = `見積書_${project?.project_name ?? projectId}_${new Date().toISOString().slice(0, 10)}.pdf`;
      await html2pdf().set({
        margin: 0,
        filename: fileName,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      }).from(container).save();
      document.body.removeChild(container);
      setMessage("PDFをダウンロードしました");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "PDF出力失敗");
    }
  };

  const handlePrintPdf = async () => {
    try {
      const html = await exportEstimateHtml(projectId, { staffName });
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
        setTimeout(() => w.print(), 500);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "印刷失敗");
    }
  };

  // --- Drag & Drop handlers ---
  const handleDragStart = useCallback((e: React.DragEvent<HTMLTableRowElement>, itemId: number) => {
    setDragItemId(itemId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(itemId));
    // 少し遅延してクラスを付与（ブラウザがドラッグイメージをキャプチャした後）
    requestAnimationFrame(() => {
      const row = e.currentTarget;
      row.classList.add("is-dragging");
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragItemId(null);
    setDragOverItemId(null);
    setDragOverPos(null);
    dragCounterRef.current = 0;
    // 全行からクラスを除去
    document.querySelectorAll("tr.is-dragging").forEach((el) => el.classList.remove("is-dragging"));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLTableRowElement>, itemId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragItemId === null || dragItemId === itemId) {
      setDragOverItemId(null);
      setDragOverPos(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? "above" : "below";
    setDragOverItemId(itemId);
    setDragOverPos(pos);
  }, [dragItemId]);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault();
    dragCounterRef.current++;
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLTableRowElement>) => {
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      // 行を離れた場合、この行のハイライトをクリア
      const targetRow = e.currentTarget;
      const relatedTarget = e.relatedTarget as Node | null;
      if (!relatedTarget || !targetRow.contains(relatedTarget)) {
        // 現在のdragOverItemIdがこの行のIDなら解除
      }
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLTableRowElement>, targetItemId: number) => {
    e.preventDefault();
    if (dragItemId === null || dragItemId === targetItemId) {
      handleDragEnd();
      return;
    }

    // 現在のitems配列（フラット、sort_order順）をコピー
    const currentIds = items.map((it) => it.id);
    const fromIdx = currentIds.indexOf(dragItemId);
    const toIdx = currentIds.indexOf(targetItemId);

    if (fromIdx === -1 || toIdx === -1) {
      handleDragEnd();
      return;
    }

    // ドラッグ元を取り除く
    const newIds = [...currentIds];
    newIds.splice(fromIdx, 1);

    // 挿入位置を計算
    let insertIdx = newIds.indexOf(targetItemId);
    if (dragOverPos === "below") {
      insertIdx += 1;
    }

    newIds.splice(insertIdx, 0, dragItemId);

    handleDragEnd();

    // 並び順を保存
    try {
      await reorderProjectItems(projectId, newIds);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "並び替え失敗");
    }
  }, [dragItemId, dragOverPos, items, projectId]);

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
        <div className="cockpit-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            担当者
            <select
              value={project?.assigned_staff_id || ""}
              onChange={async (e) => {
                const staffId = e.target.value || null;
                try {
                  await updateProjectStaff(projectId, staffId);
                  await load();
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : "担当者変更失敗");
                }
              }}
              style={{ height: 28, fontSize: 12, padding: "0 6px" }}
            >
              <option value="">未割当</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.display_name}</option>
              ))}
            </select>
          </label>
          <input
            type="text"
            value={staffName}
            onChange={(e) => setStaffName(e.target.value)}
            placeholder="担当者名"
            style={{ width: 120, padding: "4px 8px", fontSize: 12, border: "1px solid var(--c-border)", borderRadius: 4 }}
          />
          <button className="btn btn-primary" onClick={handleExportPdf}>PDF保存</button>
          <button className="btn" onClick={handlePrintPdf}>印刷</button>
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
          {/* Search-based add item form */}
          <div style={{ marginBottom: "var(--sp-4)" }}>
            {/* Selected item indicator */}
            {(selectedMaster || isCustomItem) && (
              <div className="ac-selected">
                <span className="ac-selected-name">
                  {selectedMaster ? `${selectedMaster.item_name}` : `カスタム: ${searchText}`}
                </span>
                {selectedMaster && (
                  <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>
                    ¥{selectedMaster.selling_price.toLocaleString()}/{selectedMaster.unit}
                    {" "}(原価¥{selectedMaster.cost_price.toLocaleString()}{" "}
                    <span className={mrClass(marginRate(selectedMaster.selling_price, selectedMaster.cost_price))}>
                      粗利{pct(marginRate(selectedMaster.selling_price, selectedMaster.cost_price))}
                    </span>)
                  </span>
                )}
                <span className="ac-clear" onClick={resetAddForm}>&times;</span>
              </div>
            )}

            {/* Search input with autocomplete */}
            <div className="ac-wrap">
              <input
                className="ac-input"
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setSelectedMaster(null);
                  setIsCustomItem(false);
                  setShowSuggestions(true);
                }}
                onFocus={() => { if (searchText.trim()) setShowSuggestions(true); }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onKeyDown={(e) => { if (e.key === 'Enter' && searchText.trim() && !showSuggestions) { e.preventDefault(); void handleAddItem(); } }}
                placeholder="工事項目を検索 or 自由入力してEnterで追加"
              />

              {showSuggestions && searchText.trim() && (
                <div className="ac-list">
                  {/* Template matches */}
                  {suggestions.templates.length > 0 && (
                    <>
                      <div className="ac-section">テンプレート（一括追加）</div>
                      {suggestions.templates.map((t) => (
                        <div key={t.id} className="ac-item ac-item-tpl" onMouseDown={() => void handleSelectTemplate(t)}>
                          <span className="ac-tag">{t.items.length}項目</span>
                          <span className="ac-item-name">{t.name}</span>
                          <span className="ac-item-meta">{t.description}</span>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Master item matches */}
                  {suggestions.items.length > 0 && (
                    <>
                      <div className="ac-section">工事項目マスタ</div>
                      {suggestions.items.map((wi) => (
                        <div key={wi.id} className="ac-item" onMouseDown={() => handleSelectMaster(wi)}>
                          <span className="ac-item-name">{wi.item_name}</span>
                          <span className="ac-item-meta">
                            [{wi.category}] ¥{wi.selling_price.toLocaleString()}/{wi.unit}{" "}
                            <span className={mrClass(marginRate(wi.selling_price, wi.cost_price))}>
                              {pct(marginRate(wi.selling_price, wi.cost_price))}
                            </span>
                          </span>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Custom item option */}
                  {suggestions.showCustom && (
                    <>
                      <div className="ac-section">カスタム</div>
                      <div className="ac-item ac-item-custom" onMouseDown={handleSelectCustom}>
                        <span className="ac-item-name">「{searchText.trim()}」をカスタム項目として追加</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Detail fields */}
            <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap", alignItems: "flex-end", marginTop: "var(--sp-2)" }}>
              {!selectedMaster && (
                <>
                  <label style={{ width: 100 }}>
                    カテゴリ
                    <input value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="その他" />
                  </label>
                  <label style={{ width: 60 }}>
                    単位
                    <input value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} placeholder="式" />
                  </label>
                </>
              )}
              <label style={{ width: 70 }}>
                数量
                <input type="number" value={addQty} onChange={(e) => setAddQty(e.target.value)} min="1" />
              </label>
              <label style={{ width: 100 }}>
                売値単価
                <input type="number" value={addSelling} onChange={(e) => setAddSelling(e.target.value)} placeholder="自動" />
              </label>
              <label style={{ width: 100 }}>
                原価単価
                <input type="number" value={addCost} onChange={(e) => setAddCost(e.target.value)} placeholder="自動" />
              </label>
              <button className="btn btn-primary" onClick={() => void handleAddItem()} disabled={adding || !searchText.trim()}>
                {adding ? "追加中..." : "追加"}
              </button>
            </div>
          </div>

          {/* Items table — 売値先行・粗利率%付き */}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 28 }}></th>
                  <th>項目名</th>
                  <th className="text-right">数量</th>
                  <th>単位</th>
                  <th className="text-right">単価</th>
                  <th className="text-right">金額</th>
                  <th className="text-right">原価計</th>
                  <th className="text-right">粗利</th>
                  <th className="text-right">粗利率</th>
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
                      const catMargin = catSelling - catCost;
                      const catRate = marginRate(catSelling, catCost);
                      return (
                        <React.Fragment key={cat}>
                          <tr className="group-header">
                            <td colSpan={10}>{cat}（{catItems.length}項目）</td>
                          </tr>
                          {catItems.map((item) => {
                            const iSelling = itemSellingTotal(item);
                            const iCost = itemCostTotal(item);
                            const iMar = itemMargin(item);
                            const iRate = marginRate(iSelling, iCost);
                            const isEditingQty = editingCell?.itemId === item.id && editingCell.field === 'quantity';
                            const isEditingSelling = editingCell?.itemId === item.id && editingCell.field === 'selling_price';
                            const isEditingCost = editingCell?.itemId === item.id && editingCell.field === 'cost_price';
                            return (
                              <tr
                                key={item.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, item.id)}
                                onDragEnd={handleDragEnd}
                                onDragOver={(e) => handleDragOver(e, item.id)}
                                onDragEnter={handleDragEnter}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => void handleDrop(e, item.id)}
                                className={[
                                  dragItemId === item.id ? "is-dragging" : "",
                                  dragOverItemId === item.id && dragOverPos === "above" ? "drag-over-above" : "",
                                  dragOverItemId === item.id && dragOverPos === "below" ? "drag-over-below" : "",
                                ].filter(Boolean).join(" ") || undefined}
                              >
                                <td style={{ width: 28, textAlign: "center" }}>
                                  <span className="drag-handle" title="ドラッグして並べ替え">&#x2807;</span>
                                </td>
                                <td style={{ fontWeight: 500 }}>{item.item_name}</td>
                                <td className={`text-right editable-cell`} onClick={() => !isEditingQty && startEditing(item, 'quantity')}>
                                  {isEditingQty ? (
                                    <input
                                      className="inline-edit-input"
                                      type="number"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={() => void commitEdit()}
                                      onKeyDown={(e) => { if (e.key === 'Enter') void commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                                      autoFocus
                                      min="0"
                                    />
                                  ) : item.quantity}
                                </td>
                                <td>{item.unit}</td>
                                <td className={`text-right editable-cell`} onClick={() => { if (!isEditingSelling && !isEditingCost) startEditing(item, 'selling_price'); }}>
                                  {isEditingSelling ? (
                                    <input
                                      className="inline-edit-input"
                                      type="number"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={() => void commitEdit()}
                                      onKeyDown={(e) => { if (e.key === 'Enter') void commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                                      autoFocus
                                      min="0"
                                    />
                                  ) : isEditingCost ? (
                                    <>
                                      {yen(item.selling_price)}
                                      <span className="cost-sub">原<input
                                        className="inline-edit-input"
                                        type="number"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onBlur={() => void commitEdit()}
                                        onKeyDown={(e) => { if (e.key === 'Enter') void commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                                        autoFocus
                                        min="0"
                                        style={{ width: 70, display: 'inline', fontSize: 11 }}
                                      /></span>
                                    </>
                                  ) : (
                                    <>
                                      {yen(item.selling_price)}
                                      <span className="cost-sub" onClick={(e) => { e.stopPropagation(); startEditing(item, 'cost_price'); }}>原{yen(item.cost_price)}</span>
                                    </>
                                  )}
                                </td>
                                <td className="text-right" style={{ fontWeight: 600 }}>{yen(iSelling)}</td>
                                <td className="text-right" style={{ fontSize: 12, color: "var(--c-text-3)" }}>{yen(iCost)}</td>
                                <td className="text-right" style={{ fontWeight: 600, color: iMar >= 0 ? "var(--c-success)" : "var(--c-error)" }}>
                                  {yen(iMar)}
                                </td>
                                <td className="text-right">
                                  <span className={mrClass(iRate)}>{pct(iRate)}</span>
                                </td>
                                <td>
                                  <button className="btn btn-sm btn-danger" onClick={() => void handleDeleteItem(item.id)}>削除</button>
                                </td>
                              </tr>
                            );
                          })}
                          <tr style={{ background: "var(--c-bg)", fontSize: 12 }}>
                            <td colSpan={5} style={{ fontWeight: 600, color: "var(--c-text-3)", textAlign: "right" }}>{cat} 小計</td>
                            <td className="text-right" style={{ fontWeight: 700 }}>{yen(catSelling)}</td>
                            <td className="text-right" style={{ color: "var(--c-text-3)" }}>{yen(catCost)}</td>
                            <td className="text-right" style={{ fontWeight: 600, color: catMargin >= 0 ? "var(--c-success)" : "var(--c-error)" }}>{yen(catMargin)}</td>
                            <td className="text-right"><span className={mrClass(catRate)}>{pct(catRate)}</span></td>
                            <td></td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                    <tr className="table-total-row">
                      <td colSpan={5} style={{ fontWeight: 700 }}>合計</td>
                      <td className="text-right" style={{ fontWeight: 700, fontSize: 14 }}>{yen(totalSelling)}</td>
                      <td className="text-right">{yen(totalCost)}</td>
                      <td className="text-right" style={{ fontWeight: 700, color: totalMargin >= 0 ? "var(--c-success)" : "var(--c-error)" }}>{yen(totalMargin)}</td>
                      <td className="text-right"><span className={mrClass(totalMarginRate)}>{pct(totalMarginRate)}</span></td>
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
                          <button className="btn btn-sm btn-success" onClick={() => handleInvoicePayment(inv.invoice_id, inv.invoice_amount)}>
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
                          <button className="btn btn-sm btn-success" onClick={() => handlePaymentRecord(pay.payment_id, pay.ordered_amount)}>
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

      {amountModal && (
        <div className="modal-overlay" onClick={() => setAmountModal(null)}>
          <div className="modal-body" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h3 style={{ margin: "0 0 var(--sp-3)" }}>{amountModal.label}を入力</h3>
            <input
              type="number"
              value={modalAmount}
              onChange={(e) => setModalAmount(e.target.value)}
              min="1"
              autoFocus
              style={{ width: "100%", marginBottom: "var(--sp-3)" }}
              onKeyDown={(e) => { if (e.key === "Enter") void handleAmountConfirm(); if (e.key === "Escape") setAmountModal(null); }}
            />
            <div style={{ display: "flex", gap: "var(--sp-2)", justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setAmountModal(null)}>キャンセル</button>
              <button className="btn btn-primary" onClick={() => void handleAmountConfirm()}>確定</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
