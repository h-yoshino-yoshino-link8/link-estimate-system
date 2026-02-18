"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  createInvoice,
  createPayment,
  createProjectItem,
  downloadBlob,
  exportEstimate,
  exportReceipt,
  getProject,
  getInvoices,
  getPayments,
  getProjectItems,
  getWorkItems,
  isLocalModeEnabled,
  onLocalModeChanged,
  updateInvoice,
  updatePayment,
  type Invoice,
  type Payment,
  type Project,
  type ProjectItem,
  type WorkItemMaster,
} from "../../../lib/api";

function yen(value: number) {
  return `¥${Math.round(value).toLocaleString()}`;
}

type AuditLogEntry = {
  id: string;
  project_id: string;
  category: "見積" | "請求" | "支払" | "帳票";
  action: string;
  detail: string;
  created_at: string;
};

const AUDIT_LOG_KEY = "link_estimate_audit_logs_v1";

function readAuditLogStore(): Record<string, AuditLogEntry[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(AUDIT_LOG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, AuditLogEntry[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAuditLogStore(store: Record<string, AuditLogEntry[]>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(store));
}

const CATEGORY_COLORS: Record<string, string> = {
  "見積": "cat-estimate",
  "請求": "cat-invoice",
  "支払": "cat-payment",
  "帳票": "cat-document",
};

type TabKey = "estimate" | "invoice" | "payment" | "docs";

export default function ProjectWorkspacePage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [project, setProject] = useState<Project | null>(null);
  const [workItems, setWorkItems] = useState<WorkItemMaster[]>([]);
  const [projectItems, setProjectItems] = useState<ProjectItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [localMode, setLocalMode] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("estimate");

  /* --- Estimate form: category-first selection --- */
  const [selectedCategory, setSelectedCategory] = useState("");
  const [masterItemId, setMasterItemId] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");

  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoicePaidAmount, setInvoicePaidAmount] = useState("0");
  const [invoiceType, setInvoiceType] = useState("一括");
  const [invoiceBilledAt, setInvoiceBilledAt] = useState(() => new Date().toISOString().slice(0, 10));

  const [paymentVendorName, setPaymentVendorName] = useState("");
  const [paymentOrderedAmount, setPaymentOrderedAmount] = useState("");
  const [paymentPaidAmount, setPaymentPaidAmount] = useState("0");

  const [invoiceToUpdate, setInvoiceToUpdate] = useState("");
  const [invoicePaidToUpdate, setInvoicePaidToUpdate] = useState("0");
  const [paymentToUpdate, setPaymentToUpdate] = useState("");
  const [paymentPaidToUpdate, setPaymentPaidToUpdate] = useState("0");
  const [invoiceIdForPdf, setInvoiceIdForPdf] = useState("");

  /* --- Derived values --- */
  const estimateTotal = useMemo(
    () => projectItems.reduce((sum, row) => sum + Number(row.line_total || 0), 0),
    [projectItems],
  );
  const invoiceTotal = useMemo(
    () => invoices.reduce((sum, row) => sum + Number(row.invoice_amount || 0), 0),
    [invoices],
  );
  const invoiceRemaining = useMemo(
    () => invoices.reduce((sum, row) => sum + Number(row.remaining_amount || 0), 0),
    [invoices],
  );
  const paymentTotal = useMemo(
    () => payments.reduce((sum, row) => sum + Number(row.ordered_amount || 0), 0),
    [payments],
  );
  const paymentRemaining = useMemo(
    () => payments.reduce((sum, row) => sum + Number(row.remaining_amount || 0), 0),
    [payments],
  );

  /* --- Category-first work item selection --- */
  const categories = useMemo(
    () => Array.from(new Set(workItems.map((w) => w.category))).sort(),
    [workItems],
  );
  const filteredItems = useMemo(
    () => selectedCategory ? workItems.filter((w) => w.category === selectedCategory) : workItems,
    [workItems, selectedCategory],
  );
  const selectedMaster = useMemo(
    () => workItems.find((w) => String(w.id) === masterItemId) ?? null,
    [workItems, masterItemId],
  );
  const previewLineTotal = useMemo(() => {
    if (!selectedMaster) return 0;
    return (selectedMaster.standard_unit_price ?? 0) * Number(itemQuantity || 0);
  }, [selectedMaster, itemQuantity]);

  const activeInvoice = useMemo(() => invoices.find((x) => x.invoice_id === invoiceToUpdate) ?? null, [invoices, invoiceToUpdate]);
  const activePayment = useMemo(() => payments.find((x) => x.payment_id === paymentToUpdate) ?? null, [payments, paymentToUpdate]);
  const settledSales = Math.max(invoiceTotal - invoiceRemaining, 0);
  const revenueBase = invoiceTotal > 0 ? invoiceTotal : estimateTotal;
  const grossEstimate = revenueBase - paymentTotal;
  const grossRate = revenueBase > 0 ? (grossEstimate / revenueBase) * 100 : 0;
  const targetMarginRate = (project?.target_margin_rate ?? 0.25) * 100;
  const marginWarning = revenueBase > 0 && grossRate < targetMarginRate;

  const stepEstimateDone = projectItems.length > 0;
  const stepInvoiceDone = invoices.length > 0 && invoiceRemaining <= 0;
  const stepPaymentDone = payments.length > 0;

  const nextAction = useMemo(() => {
    if (!stepEstimateDone) {
      return { step: 1, title: "見積明細を追加してください", detail: "工事カテゴリと項目を選び、数量を入力して追加します。", tab: "estimate" as TabKey };
    }
    if (invoices.length === 0) {
      return { step: 2, title: "請求を登録してください", detail: "請求額を入力して登録します。", tab: "invoice" as TabKey };
    }
    if (!stepInvoiceDone) {
      return { step: 2, title: "入金反映を完了してください", detail: "入金額を更新して未入金残を0にします。", tab: "invoice" as TabKey };
    }
    if (!stepPaymentDone) {
      return { step: 3, title: "業者支払を登録してください", detail: "業者名と発注額を入力して登録します。", tab: "payment" as TabKey };
    }
    return { step: 4, title: "書類発行・連絡へ進めます", detail: "見積書/領収書PDFの出力と請求メール文面作成を実行できます。", tab: "docs" as TabKey };
  }, [stepEstimateDone, stepInvoiceDone, stepPaymentDone, invoices.length]);

  /* --- Data loading --- */
  const loadWorkspace = async () => {
    const [projectResp, workItemsResp, itemsResp, invoicesResp, paymentsResp] = await Promise.all([
      getProject(projectId),
      getWorkItems(),
      getProjectItems(projectId),
      getInvoices(projectId),
      getPayments(projectId),
    ]);

    setProject(projectResp ?? null);
    setWorkItems(workItemsResp);
    setProjectItems(itemsResp);
    setInvoices(invoicesResp);
    setPayments(paymentsResp);

    if (workItemsResp.length > 0) {
      const cats = Array.from(new Set(workItemsResp.map((w) => w.category))).sort();
      if (cats.length > 0 && !selectedCategory) setSelectedCategory(cats[0]);
      setMasterItemId((prev) => (prev ? prev : String(workItemsResp[0].id)));
    }

    const firstInvoice = invoicesResp[0];
    setInvoiceToUpdate(firstInvoice?.invoice_id ?? "");
    setInvoicePaidToUpdate(firstInvoice ? String(firstInvoice.paid_amount) : "0");
    setInvoiceIdForPdf(firstInvoice?.invoice_id ?? "");
    setInvoiceBilledAt(firstInvoice?.billed_at ?? new Date().toISOString().slice(0, 10));

    const firstPayment = paymentsResp[0];
    setPaymentToUpdate(firstPayment?.payment_id ?? "");
    setPaymentPaidToUpdate(firstPayment ? String(firstPayment.paid_amount) : "0");
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMessage("");
      try {
        await loadWorkspace();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "案件データ取得に失敗しました");
        setMessageType("error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    const refresh = () => setLocalMode(isLocalModeEnabled());
    refresh();
    const unsubscribe = onLocalModeChanged(refresh);
    window.addEventListener("focus", refresh);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    const store = readAuditLogStore();
    setAuditLogs(store[projectId] ?? []);
  }, [projectId]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // When category changes, auto-select first item in that category
  useEffect(() => {
    if (!selectedCategory) return;
    const items = workItems.filter((w) => w.category === selectedCategory);
    if (items.length > 0) {
      setMasterItemId(String(items[0].id));
    }
  }, [selectedCategory, workItems]);

  /* --- Helpers --- */
  const appendAuditLog = (category: AuditLogEntry["category"], action: string, detail: string) => {
    if (typeof window === "undefined") return;
    const entry: AuditLogEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      project_id: projectId,
      category,
      action,
      detail,
      created_at: new Date().toISOString(),
    };
    const store = readAuditLogStore();
    const next = [entry, ...(store[projectId] ?? [])].slice(0, 120);
    store[projectId] = next;
    writeAuditLogStore(store);
    setAuditLogs(next);
  };

  const showMsg = (text: string, type: "success" | "error" | "info" = "info") => {
    setMessage(text);
    setMessageType(type);
    if (type === "success") {
      setTimeout(() => setMessage(""), 4000);
    }
  };

  const showPreview = (blob: Blob, title: string) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setPreviewTitle(title);
  };

  /* --- Actions --- */
  const onReload = async () => {
    setWorking(true);
    setMessage("");
    try {
      await loadWorkspace();
      showMsg("案件データを再読込しました", "success");
    } catch (error) {
      showMsg(error instanceof Error ? error.message : "再読込に失敗しました", "error");
    } finally {
      setWorking(false);
    }
  };

  const onAddProjectItem = async () => {
    if (!selectedMaster) {
      showMsg("工事項目を選択してください", "error");
      return;
    }
    setWorking(true);
    setMessage("");
    try {
      await createProjectItem(projectId, {
        master_item_id: selectedMaster.id,
        quantity: Number(itemQuantity || "1"),
      });
      await loadWorkspace();
      appendAuditLog("見積", "明細追加", `${selectedMaster.item_name} × ${itemQuantity}${selectedMaster.unit ?? "式"} = ${yen(previewLineTotal)}`);
      showMsg(`「${selectedMaster.item_name}」を追加しました（${yen(previewLineTotal)}）`, "success");
      setItemQuantity("1");
    } catch (error) {
      showMsg(error instanceof Error ? error.message : "明細追加に失敗しました", "error");
    } finally {
      setWorking(false);
    }
  };

  const onAddInvoice = async () => {
    setWorking(true);
    setMessage("");
    try {
      const created = await createInvoice({
        project_id: projectId,
        invoice_amount: Number(invoiceAmount || "0"),
        paid_amount: Number(invoicePaidAmount || "0"),
        invoice_type: invoiceType,
        billed_at: invoiceBilledAt,
      });
      await loadWorkspace();
      setInvoiceIdForPdf(created.invoice_id);
      appendAuditLog("請求", "請求登録", `${created.invoice_id} / 請求額 ${yen(created.invoice_amount)}`);
      showMsg(`請求を登録しました: ${created.invoice_id}`, "success");
      setInvoiceAmount("");
      setInvoicePaidAmount("0");
    } catch (error) {
      showMsg(error instanceof Error ? error.message : "請求登録に失敗しました", "error");
    } finally {
      setWorking(false);
    }
  };

  const onAddPayment = async () => {
    setWorking(true);
    setMessage("");
    try {
      const created = await createPayment({
        project_id: projectId,
        vendor_name: paymentVendorName,
        ordered_amount: Number(paymentOrderedAmount || "0"),
        paid_amount: Number(paymentPaidAmount || "0"),
        status: "❌未支払",
      });
      await loadWorkspace();
      appendAuditLog("支払", "支払登録", `${created.payment_id} / 発注額 ${yen(created.ordered_amount)}`);
      showMsg(`支払を登録しました: ${created.payment_id}`, "success");
      setPaymentVendorName("");
      setPaymentOrderedAmount("");
      setPaymentPaidAmount("0");
    } catch (error) {
      showMsg(error instanceof Error ? error.message : "支払登録に失敗しました", "error");
    } finally {
      setWorking(false);
    }
  };

  const onSettleInvoice = async () => {
    if (!invoiceToUpdate) {
      showMsg("更新対象の請求IDを選択してください", "error");
      return;
    }
    setWorking(true);
    setMessage("");
    try {
      const updated = await updateInvoice(invoiceToUpdate, {
        paid_amount: Number(invoicePaidToUpdate || "0"),
      });
      await loadWorkspace();
      setInvoiceIdForPdf(updated.invoice_id);
      appendAuditLog("請求", "入金反映", `${updated.invoice_id} / 入金額 ${yen(updated.paid_amount)}`);
      showMsg(`入金を反映しました: ${updated.invoice_id} / ${updated.status}`, "success");
    } catch (error) {
      showMsg(error instanceof Error ? error.message : "入金反映に失敗しました", "error");
    } finally {
      setWorking(false);
    }
  };

  const onSettlePayment = async () => {
    if (!paymentToUpdate) {
      showMsg("更新対象の支払IDを選択してください", "error");
      return;
    }
    setWorking(true);
    setMessage("");
    try {
      const updated = await updatePayment(paymentToUpdate, {
        paid_amount: Number(paymentPaidToUpdate || "0"),
      });
      await loadWorkspace();
      appendAuditLog("支払", "支払消込反映", `${updated.payment_id} / 支払額 ${yen(updated.paid_amount)}`);
      showMsg(`支払を更新しました: ${updated.payment_id} / ${updated.status}`, "success");
    } catch (error) {
      showMsg(error instanceof Error ? error.message : "支払更新に失敗しました", "error");
    } finally {
      setWorking(false);
    }
  };

  const onExportEstimate = async () => {
    setWorking(true);
    setPreviewLoading(true);
    setMessage("");
    try {
      const { blob } = await exportEstimate(projectId);
      downloadBlob(blob, `estimate_${projectId}.pdf`);
      showPreview(blob, `見積書 / ${projectId}`);
      appendAuditLog("帳票", "見積書PDF出力", `estimate_${projectId}.pdf`);
      showMsg("見積書PDFを出力しました", "success");
    } catch (error) {
      showMsg(
        error instanceof Error
          ? `見積書PDF出力に失敗しました: ${error.message}。再試行するか、ネットワーク接続を確認してください。`
          : "見積書PDF出力に失敗しました。再試行してください。",
        "error",
      );
    } finally {
      setWorking(false);
      setPreviewLoading(false);
    }
  };

  const onExportReceipt = async () => {
    if (!invoiceIdForPdf) {
      showMsg("請求IDを選択してください", "error");
      return;
    }
    setWorking(true);
    setPreviewLoading(true);
    setMessage("");
    try {
      const { blob } = await exportReceipt(invoiceIdForPdf);
      downloadBlob(blob, `receipt_${invoiceIdForPdf}.pdf`);
      showPreview(blob, `領収書 / ${invoiceIdForPdf}`);
      appendAuditLog("帳票", "領収書PDF出力", `receipt_${invoiceIdForPdf}.pdf`);
      showMsg("領収書PDFを出力しました", "success");
    } catch (error) {
      showMsg(
        error instanceof Error
          ? `領収書PDF出力に失敗しました: ${error.message}。再試行するか、ネットワーク接続を確認してください。`
          : "領収書PDF出力に失敗しました。再試行してください。",
        "error",
      );
    } finally {
      setWorking(false);
      setPreviewLoading(false);
    }
  };

  const onDraftInvoiceMail = () => {
    const selectedInvoice = invoices.find((x) => x.invoice_id === invoiceIdForPdf) ?? invoices[0];
    if (!selectedInvoice) {
      showMsg("請求データがありません", "error");
      return;
    }

    const subject = encodeURIComponent(`【${projectId}】ご請求のご案内`);
    const body = encodeURIComponent([
      `${project?.customer_name ?? "お客様"} 様`,
      "",
      `案件名: ${project?.project_name ?? "-"}`,
      `請求ID: ${selectedInvoice.invoice_id}`,
      `請求金額: ${yen(selectedInvoice.invoice_amount)}`,
      `未入金残額: ${yen(selectedInvoice.remaining_amount)}`,
      "",
      "いつもありがとうございます。ご確認のほどよろしくお願いいたします。",
    ].join("\n"));

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    appendAuditLog("帳票", "請求メール文面作成", `対象請求ID ${selectedInvoice.invoice_id}`);
    showMsg("メール文面を生成しました（メーラーが開きます）", "success");
  };

  /* --- Loading state --- */
  if (loading) {
    return (
      <main className="page">
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <p className="text-muted">案件ワークスペースを読み込み中...</p>
        </div>
      </main>
    );
  }

  /* --- Render --- */
  return (
    <main className="page">
      {/* Cockpit Header */}
      <div className="cockpit-header">
        <div className="cockpit-meta">
          <h1>{project?.project_name ?? "-"}</h1>
          <p>
            <span className="id-mono">{projectId}</span>
            {" / "}
            {project?.customer_name ?? "-"}
            {" / "}
            {project?.owner_name ?? "-"}
            {" / "}
            <span className="badge badge-default">{project?.project_status ?? "-"}</span>
          </p>
        </div>
        <div className="cockpit-actions">
          <Link href="/projects" className="btn btn-ghost" style={{ textDecoration: "none" }}>
            案件一覧
          </Link>
          <button className="btn" onClick={onReload} disabled={working}>
            再読込
          </button>
        </div>
      </div>

      {localMode ? <div className="warning-bar">ローカルモード: このブラウザ内に保存されます（サーバー未接続）</div> : null}

      {message ? (
        <div className={`message animate-in ${messageType === "error" ? "message-error" : ""} ${messageType === "success" ? "message-success" : ""}`}>
          {message}
        </div>
      ) : null}

      {/* KPI Row */}
      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-label">見積金額</span>
          <span className="kpi-value">{yen(estimateTotal)}</span>
          <span className="kpi-sub">{projectItems.length}件の明細</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">請求金額</span>
          <span className="kpi-value">{yen(invoiceTotal)}</span>
          <span className="kpi-sub">{invoices.length}件の請求</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">入金済み</span>
          <span className="kpi-value">{yen(settledSales)}</span>
          <span className="kpi-sub">{invoiceRemaining > 0 ? `未回収 ${yen(invoiceRemaining)}` : "全額回収済み"}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">原価（業者発注）</span>
          <span className="kpi-value">{yen(paymentTotal)}</span>
          <span className="kpi-sub">{paymentRemaining > 0 ? `未払い ${yen(paymentRemaining)}` : payments.length > 0 ? "全額支払済み" : "未登録"}</span>
        </div>
        <div className={`kpi-card ${marginWarning ? "kpi-warn" : ""}`}>
          <span className="kpi-label">粗利見込み</span>
          <span className="kpi-value">{yen(grossEstimate)}</span>
          <span className="kpi-sub">
            利益率 {grossRate.toFixed(1)}%
            {marginWarning ? ` — 目標${targetMarginRate.toFixed(0)}%を下回っています` : ""}
          </span>
        </div>
      </div>

      {/* Step Progress */}
      <div className="step-progress">
        <span className={`step-item ${stepEstimateDone ? "is-done" : nextAction.step === 1 ? "is-current" : ""}`}>1. 見積</span>
        <span className="step-connector" />
        <span className={`step-item ${stepInvoiceDone ? "is-done" : nextAction.step === 2 ? "is-current" : ""}`}>2. 請求・入金</span>
        <span className="step-connector" />
        <span className={`step-item ${stepPaymentDone ? "is-done" : nextAction.step === 3 ? "is-current" : ""}`}>3. 支払</span>
        <span className="step-connector" />
        <span className={`step-item ${nextAction.step > 4 ? "is-done" : nextAction.step === 4 ? "is-current" : ""}`}>4. 書類</span>
      </div>

      {/* Next Action Banner */}
      <div className="next-banner">
        <div className="next-banner-text">
          <span className="next-banner-label">Next Action</span>
          <span className="next-banner-title">STEP {nextAction.step}: {nextAction.title}</span>
          <span className="next-banner-desc">{nextAction.detail}</span>
        </div>
        <button className="btn btn-primary" onClick={() => setActiveTab(nextAction.tab)}>
          このステップへ移動
        </button>
      </div>

      {/* Tabs */}
      <div className="tab-row">
        <button className={`tab-btn ${activeTab === "estimate" ? "is-active" : ""}`} onClick={() => setActiveTab("estimate")}>
          見積 {projectItems.length > 0 ? <span className="tab-badge">{projectItems.length}</span> : null}
        </button>
        <button className={`tab-btn ${activeTab === "invoice" ? "is-active" : ""}`} onClick={() => setActiveTab("invoice")}>
          請求・入金 {invoices.length > 0 ? <span className="tab-badge">{invoices.length}</span> : null}
        </button>
        <button className={`tab-btn ${activeTab === "payment" ? "is-active" : ""}`} onClick={() => setActiveTab("payment")}>
          支払 {payments.length > 0 ? <span className="tab-badge">{payments.length}</span> : null}
        </button>
        <button className={`tab-btn ${activeTab === "docs" ? "is-active" : ""}`} onClick={() => setActiveTab("docs")}>
          書類・連絡
        </button>
      </div>

      {/* === TAB: Estimate === */}
      {activeTab === "estimate" ? (
        <div className="animate-in" style={{ display: "grid", gap: "var(--sp-5)" }}>
          {/* Item Add Card */}
          <div className="card">
            <h3 className="card-title">工事項目を見積に追加</h3>
            <p className="card-desc">
              カテゴリを選んで工事項目を絞り込み、数量を入力してください。
              追加ボタンを押すと見積明細に反映されます。
            </p>

            {/* Step A: Category */}
            <div style={{ display: "grid", gap: "var(--sp-4)" }}>
              <div className="form-row-3" style={{ alignItems: "end" }}>
                <label>
                  <span className="label-text">工事カテゴリ</span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    disabled={working}
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="label-text">工事項目</span>
                  <select
                    value={masterItemId}
                    onChange={(e) => setMasterItemId(e.target.value)}
                    disabled={working}
                  >
                    {filteredItems.map((w) => (
                      <option key={w.id} value={String(w.id)}>
                        {w.item_name}（{yen(w.standard_unit_price)}/{w.unit ?? "式"}）
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="label-text">数量</span>
                  <input
                    type="number"
                    min="1"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(e.target.value)}
                    style={{ textAlign: "right" }}
                  />
                </label>
              </div>

              {/* Calculation Preview */}
              {selectedMaster ? (
                <div className="calc-preview">
                  <span className="calc-preview-label">追加される金額:</span>
                  <span className="calc-preview-formula">
                    {yen(selectedMaster.standard_unit_price)}/{selectedMaster.unit ?? "式"} × {itemQuantity || 0}{selectedMaster.unit ?? "式"}
                  </span>
                  <span className="calc-preview-eq">=</span>
                  <span className="calc-preview-result">{yen(previewLineTotal)}</span>
                </div>
              ) : null}

              <button
                className="btn btn-primary"
                onClick={onAddProjectItem}
                disabled={working || !selectedMaster}
                style={{ justifySelf: "start" }}
              >
                この項目を見積に追加
              </button>
            </div>
          </div>

          {/* Estimate Table */}
          <div className="card">
            <h3 className="card-title">見積明細一覧</h3>
            {projectItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">&#128221;</div>
                <p className="empty-state-text">見積明細はまだありません。上のフォームから工事項目を追加してください。</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>カテゴリ</th>
                      <th>工事項目</th>
                      <th className="text-right">単価</th>
                      <th className="text-right">数量</th>
                      <th className="text-right">金額（単価 × 数量）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectItems.map((item) => (
                      <tr key={item.id}>
                        <td><span className="badge badge-default">{item.category}</span></td>
                        <td><strong>{item.item_name}</strong></td>
                        <td className="text-right text-muted">{yen(item.unit_price)}/{item.unit ?? "式"}</td>
                        <td className="text-right">{item.quantity}{item.unit ?? "式"}</td>
                        <td className="text-right"><strong>{yen(item.line_total)}</strong></td>
                      </tr>
                    ))}
                    <tr className="table-total-row">
                      <td colSpan={4} className="text-right"><strong>見積合計</strong></td>
                      <td className="text-right"><strong>{yen(estimateTotal)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Project Info (collapsible) */}
          <details className="card">
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>案件情報を表示</summary>
            <div className="form-row-3 mt-3">
              <label>
                <span className="label-text">顧客名</span>
                <input value={project?.customer_name ?? ""} disabled />
              </label>
              <label>
                <span className="label-text">物件名</span>
                <input value={project?.project_name ?? ""} disabled />
              </label>
              <label>
                <span className="label-text">施工住所</span>
                <input value={project?.site_address ?? ""} disabled />
              </label>
            </div>
            <div className="form-row-3 mt-3">
              <label>
                <span className="label-text">管理担当</span>
                <input value={project?.owner_name ?? ""} disabled />
              </label>
              <label>
                <span className="label-text">目標粗利率</span>
                <input value={`${targetMarginRate.toFixed(1)}%`} disabled />
              </label>
              <label>
                <span className="label-text">作成日</span>
                <input value={project?.created_at ?? ""} disabled />
              </label>
            </div>
          </details>
        </div>
      ) : null}

      {/* === TAB: Invoice === */}
      {activeTab === "invoice" ? (
        <div className="animate-in" style={{ display: "grid", gap: "var(--sp-5)" }}>
          <div className="mini-kpi-row">
            <div className="mini-kpi">
              <span className="mini-label">請求件数</span>
              <span className="mini-value">{invoices.length} 件</span>
            </div>
            <div className="mini-kpi">
              <span className="mini-label">未回収残</span>
              <span className={`mini-value ${invoiceRemaining > 0 ? "text-warn" : ""}`}>{yen(invoiceRemaining)}</span>
            </div>
            <div className="mini-kpi">
              <span className="mini-label">入金済み</span>
              <span className="mini-value text-ok">{yen(settledSales)}</span>
            </div>
          </div>

          <div className="subcard-row">
            <div className="subcard">
              <h4 className="subcard-title">新しい請求を登録</h4>
              <div className="form-grid">
                <div className="form-row-2">
                  <label>
                    <span className="label-text">請求種別</span>
                    <input value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)} />
                  </label>
                  <label>
                    <span className="label-text">請求額</span>
                    <input type="number" placeholder="請求額を入力" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} />
                  </label>
                </div>
                <div className="form-row-2">
                  <label>
                    <span className="label-text">請求日</span>
                    <input type="date" value={invoiceBilledAt} onChange={(e) => setInvoiceBilledAt(e.target.value)} />
                  </label>
                  <label>
                    <span className="label-text">初回入金額</span>
                    <input value={invoicePaidAmount} onChange={(e) => setInvoicePaidAmount(e.target.value)} />
                  </label>
                </div>
                <button className="btn btn-primary" onClick={onAddInvoice} disabled={working}>
                  請求を登録
                </button>
              </div>
            </div>

            <div className="subcard">
              <h4 className="subcard-title">入金を反映する</h4>
              {invoices.length === 0 ? (
                <p className="form-help">まず請求を登録してください</p>
              ) : (
                <div className="form-grid">
                  <label>
                    <span className="label-text">対象の請求</span>
                    <select
                      value={invoiceToUpdate}
                      onChange={(e) => {
                        setInvoiceToUpdate(e.target.value);
                        const matched = invoices.find((x) => x.invoice_id === e.target.value);
                        if (matched) setInvoicePaidToUpdate(String(matched.paid_amount));
                      }}
                      disabled={working}
                    >
                      {invoices.map((inv) => (
                        <option key={inv.invoice_id} value={inv.invoice_id}>
                          {inv.invoice_id} — 未回収 {yen(inv.remaining_amount)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="label-text">入金額（累計）</span>
                    <input value={invoicePaidToUpdate} onChange={(e) => setInvoicePaidToUpdate(e.target.value)} />
                  </label>
                  <button className="btn btn-primary" onClick={onSettleInvoice} disabled={working || !invoiceToUpdate}>
                    入金を反映
                  </button>
                  {activeInvoice ? (
                    <p className="form-help">現在の状態: {activeInvoice.status ?? "-"}</p>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {invoices.length > 0 ? (
            <div className="card">
              <h3 className="card-title">請求一覧</h3>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>請求ID</th>
                      <th>種別</th>
                      <th className="text-right">請求額</th>
                      <th className="text-right">入金済み</th>
                      <th className="text-right">未回収</th>
                      <th>状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.invoice_id}>
                        <td><span className="id-mono">{inv.invoice_id}</span></td>
                        <td>{inv.invoice_type ?? "-"}</td>
                        <td className="text-right">{yen(inv.invoice_amount)}</td>
                        <td className="text-right">{yen(inv.paid_amount)}</td>
                        <td className="text-right">{yen(inv.remaining_amount)}</td>
                        <td>
                          <span className={`badge ${inv.remaining_amount > 0 ? "badge-warning" : "badge-success"}`}>
                            {inv.status ?? "-"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* === TAB: Payment === */}
      {activeTab === "payment" ? (
        <div className="animate-in" style={{ display: "grid", gap: "var(--sp-5)" }}>
          <div className="mini-kpi-row">
            <div className="mini-kpi">
              <span className="mini-label">発注件数</span>
              <span className="mini-value">{payments.length} 件</span>
            </div>
            <div className="mini-kpi">
              <span className="mini-label">発注合計（原価）</span>
              <span className="mini-value">{yen(paymentTotal)}</span>
            </div>
            <div className="mini-kpi">
              <span className="mini-label">未払い残</span>
              <span className={`mini-value ${paymentRemaining > 0 ? "text-warn" : ""}`}>{yen(paymentRemaining)}</span>
            </div>
          </div>

          <div className="subcard-row">
            <div className="subcard">
              <h4 className="subcard-title">業者への支払を登録</h4>
              <div className="form-grid">
                <label>
                  <span className="label-text">業者名</span>
                  <input placeholder="業者名を入力" value={paymentVendorName} onChange={(e) => setPaymentVendorName(e.target.value)} />
                </label>
                <div className="form-row-2">
                  <label>
                    <span className="label-text">発注額</span>
                    <input type="number" placeholder="発注額を入力" value={paymentOrderedAmount} onChange={(e) => setPaymentOrderedAmount(e.target.value)} />
                  </label>
                  <label>
                    <span className="label-text">支払済み額</span>
                    <input value={paymentPaidAmount} onChange={(e) => setPaymentPaidAmount(e.target.value)} />
                  </label>
                </div>
                <button className="btn btn-primary" onClick={onAddPayment} disabled={working}>
                  支払を登録
                </button>
              </div>
            </div>

            <div className="subcard">
              <h4 className="subcard-title">支払を消込する</h4>
              {payments.length === 0 ? (
                <p className="form-help">まず支払を登録してください</p>
              ) : (
                <div className="form-grid">
                  <label>
                    <span className="label-text">対象の支払</span>
                    <select
                      value={paymentToUpdate}
                      onChange={(e) => {
                        setPaymentToUpdate(e.target.value);
                        const matched = payments.find((x) => x.payment_id === e.target.value);
                        if (matched) setPaymentPaidToUpdate(String(matched.paid_amount));
                      }}
                      disabled={working}
                    >
                      {payments.map((pay) => (
                        <option key={pay.payment_id} value={pay.payment_id}>
                          {pay.vendor_name} — 未払い {yen(pay.remaining_amount)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="label-text">支払額（累計）</span>
                    <input value={paymentPaidToUpdate} onChange={(e) => setPaymentPaidToUpdate(e.target.value)} />
                  </label>
                  <button className="btn btn-primary" onClick={onSettlePayment} disabled={working || !paymentToUpdate}>
                    消込を反映
                  </button>
                  {activePayment ? (
                    <p className="form-help">現在の状態: {activePayment.status ?? "-"}</p>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {payments.length > 0 ? (
            <div className="card">
              <h3 className="card-title">支払一覧</h3>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>業者名</th>
                      <th className="text-right">発注額</th>
                      <th className="text-right">支払済み</th>
                      <th className="text-right">未払い</th>
                      <th>状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((pay) => (
                      <tr key={pay.payment_id}>
                        <td><strong>{pay.vendor_name ?? "-"}</strong></td>
                        <td className="text-right">{yen(pay.ordered_amount)}</td>
                        <td className="text-right">{yen(pay.paid_amount)}</td>
                        <td className="text-right">{yen(pay.remaining_amount)}</td>
                        <td>
                          <span className={`badge ${pay.remaining_amount > 0 ? "badge-warning" : "badge-success"}`}>
                            {pay.status ?? "-"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* === TAB: Docs === */}
      {activeTab === "docs" ? (
        <div className="animate-in" style={{ display: "grid", gap: "var(--sp-5)" }}>
          <div className="card">
            <h3 className="card-title">書類発行・連絡</h3>
            <p className="card-desc">帳票PDFを出力するとダウンロードされ、下のプレビューに表示されます。</p>

            <div className="doc-actions mb-4">
              <button className="btn btn-primary" onClick={onExportEstimate} disabled={working}>
                見積書PDF出力
              </button>
              <button className="btn" onClick={onExportReceipt} disabled={working || !invoiceIdForPdf}>
                領収書PDF出力
              </button>
              <button className="btn btn-ghost" onClick={onDraftInvoiceMail} disabled={working || invoices.length === 0}>
                請求メール文面を作成
              </button>
            </div>

            {invoices.length > 0 ? (
              <label className="mb-4">
                <span className="label-text">領収書の対象請求</span>
                <select value={invoiceIdForPdf} onChange={(e) => setInvoiceIdForPdf(e.target.value)} disabled={working}>
                  {invoices.map((inv) => (
                    <option key={inv.invoice_id} value={inv.invoice_id}>
                      {inv.invoice_id} — 入金済み {yen(inv.paid_amount)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {previewUrl ? (
              <>
                <div className="preview-meta mt-4">
                  <strong>{previewTitle}</strong>
                  <span>A4横</span>
                </div>
                <div className="preview-shell">
                  {previewLoading ? (
                    <p className="text-muted">帳票を生成中...</p>
                  ) : (
                    <iframe title={previewTitle || "帳票プレビュー"} src={previewUrl} />
                  )}
                </div>
              </>
            ) : (
              <p className="form-help mt-3">帳票PDFを出力すると、ここにプレビューが表示されます。</p>
            )}
          </div>

          {/* Audit Log */}
          <div className="card">
            <button className="audit-toggle" onClick={() => setShowAuditLog(!showAuditLog)}>
              {showAuditLog ? "操作履歴を閉じる" : `操作履歴を表示（${auditLogs.length}件）`}
            </button>
            {showAuditLog ? (
              auditLogs.length === 0 ? (
                <p className="form-help mt-2">操作を実行すると履歴が記録されます。</p>
              ) : (
                <ul className="audit-list mt-2">
                  {auditLogs.map((row) => (
                    <li key={row.id} className="audit-item">
                      <div className="audit-head">
                        <span className={`audit-cat ${CATEGORY_COLORS[row.category] ?? ""}`}>{row.category}</span>
                        <span className="audit-action">{row.action}</span>
                        <span className="audit-time">
                          {new Date(row.created_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <span className="audit-detail">{row.detail}</span>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
