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

  const [masterItemId, setMasterItemId] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");

  const [invoiceAmount, setInvoiceAmount] = useState("100000");
  const [invoicePaidAmount, setInvoicePaidAmount] = useState("0");
  const [invoiceType, setInvoiceType] = useState("一括");
  const [invoiceBilledAt, setInvoiceBilledAt] = useState(() => new Date().toISOString().slice(0, 10));

  const [paymentVendorName, setPaymentVendorName] = useState("テスト業者");
  const [paymentOrderedAmount, setPaymentOrderedAmount] = useState("50000");
  const [paymentPaidAmount, setPaymentPaidAmount] = useState("0");

  const [invoiceToUpdate, setInvoiceToUpdate] = useState("");
  const [invoicePaidToUpdate, setInvoicePaidToUpdate] = useState("0");
  const [paymentToUpdate, setPaymentToUpdate] = useState("");
  const [paymentPaidToUpdate, setPaymentPaidToUpdate] = useState("0");
  const [invoiceIdForPdf, setInvoiceIdForPdf] = useState("");

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

  const masterOptions = useMemo(
    () => workItems.map((w) => ({ id: w.id, label: `${w.category} / ${w.item_name} / ¥${w.standard_unit_price}` })),
    [workItems],
  );
  const activeInvoice = useMemo(() => invoices.find((x) => x.invoice_id === invoiceToUpdate) ?? null, [invoices, invoiceToUpdate]);
  const activePayment = useMemo(() => payments.find((x) => x.payment_id === paymentToUpdate) ?? null, [payments, paymentToUpdate]);
  const settledSales = Math.max(invoiceTotal - invoiceRemaining, 0);
  const revenueBase = invoiceTotal > 0 ? invoiceTotal : estimateTotal;
  const grossEstimate = revenueBase - paymentTotal;
  const grossRate = revenueBase > 0 ? (grossEstimate / revenueBase) * 100 : 0;
  const targetMarginRate = (project?.target_margin_rate ?? 0.25) * 100;
  const marginWarning = revenueBase > 0 && grossRate < targetMarginRate;

  const stepEstimateDone = projectItems.length > 0;
  const stepInvoiceDone = invoices.length > 0;
  const stepInvoiceSettled = invoices.length > 0 && invoiceRemaining <= 0;
  const stepPaymentDone = payments.length > 0;

  const nextAction = useMemo(() => {
    if (!stepEstimateDone) {
      return {
        step: 1,
        title: "見積明細を追加してください",
        detail: "左列の「見積を作る」で工事項目を選び「明細追加」を押します。",
        anchor: "#step-estimate",
      };
    }
    if (!stepInvoiceDone) {
      return {
        step: 2,
        title: "請求を登録してください",
        detail: "中央列の「請求登録」で請求額を入力し登録します。",
        anchor: "#step-invoice",
      };
    }
    if (!stepInvoiceSettled) {
      return {
        step: 2,
        title: "入金反映を完了してください",
        detail: "更新対象請求IDを選び、入金額を更新して未入金残を0にします。",
        anchor: "#step-invoice",
      };
    }
    if (!stepPaymentDone) {
      return {
        step: 3,
        title: "業者支払を登録してください",
        detail: "右列の「支払登録」で業者名と発注額を入力し登録します。",
        anchor: "#step-payment",
      };
    }
    return {
      step: 4,
      title: "書類発行・連絡へ進めます",
      detail: "見積書/領収書PDFの出力と請求メール文面作成を実行できます。",
      anchor: "#step-docs",
    };
  }, [stepEstimateDone, stepInvoiceDone, stepInvoiceSettled, stepPaymentDone]);

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

  const appendAuditLog = (
    category: AuditLogEntry["category"],
    action: string,
    detail: string,
  ) => {
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
  };

  const showPreview = (blob: Blob, title: string) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setPreviewTitle(title);
  };

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
    setWorking(true);
    setMessage("");
    try {
      await createProjectItem(projectId, {
        master_item_id: masterItemId ? Number(masterItemId) : undefined,
        quantity: Number(itemQuantity || "1"),
      });
      await loadWorkspace();
      appendAuditLog("見積", "明細追加", `項目ID ${masterItemId || "-"} / 数量 ${itemQuantity || "1"}`);
      showMsg("明細を追加しました", "success");
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

  if (loading) {
    return (
      <main className="page">
        <section className="panel">
          <h2>案件ワークスペースを読み込み中...</h2>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="fm-shell fm-shell-simple">
        {/* Header */}
        <header className="fm-header">
          <div className="fm-title-wrap">
            <h1>案件コックピット</h1>
            <p>
              <span className="id-mono">{projectId}</span> / <strong>{project?.project_name ?? "-"}</strong>
            </p>
            <p>
              顧客: {project?.customer_name ?? "-"} / 担当: {project?.owner_name ?? "-"} / ステータス:{" "}
              <span className="status-badge-ws">{project?.project_status ?? "-"}</span>
            </p>
          </div>
          <div className="fm-head-actions">
            <Link href="/projects" className="fm-btn fm-btn-ghost">
              案件一覧に戻る
            </Link>
            <button className="fm-btn fm-btn-ghost" onClick={onReload} disabled={working}>
              再読込
            </button>
          </div>
        </header>

        {/* KPI Row */}
        <section className="fm-kpi-row">
          <article className="fm-kpi">
            <span>見積金額</span>
            <strong>{yen(estimateTotal)}</strong>
            <span>{projectItems.length}明細</span>
          </article>
          <article className="fm-kpi">
            <span>請求金額</span>
            <strong>{yen(invoiceTotal)}</strong>
            <span>{invoices.length}件</span>
          </article>
          <article className="fm-kpi">
            <span>入金済</span>
            <strong>{yen(settledSales)}</strong>
            <span>未回収 {yen(invoiceRemaining)}</span>
          </article>
          <article className="fm-kpi">
            <span>原価（発注額）</span>
            <strong>{yen(paymentTotal)}</strong>
            <span>未払 {yen(paymentRemaining)}</span>
          </article>
          <article className={`fm-kpi ${marginWarning ? "fm-kpi-warn" : ""}`}>
            <span>粗利見込</span>
            <strong>{yen(grossEstimate)}</strong>
            <span>利益率 {grossRate.toFixed(1)}%{marginWarning ? ` (目標 ${targetMarginRate.toFixed(0)}% 未達)` : ""}</span>
          </article>
        </section>

        {localMode ? <p className="warning">ローカルモード: このブラウザ内に保存されます（サーバー未接続）。</p> : null}

        {/* Next Action Banner */}
        <section className="fm-action-banner">
          <div>
            <p className="fm-action-label">次にやること</p>
            <strong>STEP {nextAction.step}: {nextAction.title}</strong>
            <p className="fm-step-note">{nextAction.detail}</p>
            <div className="fm-step-chips">
              <span className={`fm-step-chip ${stepEstimateDone ? "is-done" : nextAction.step === 1 ? "is-current" : ""}`}>1. 見積</span>
              <span className={`fm-step-chip ${stepInvoiceDone ? "is-done" : nextAction.step === 2 ? "is-current" : ""}`}>2. 請求</span>
              <span className={`fm-step-chip ${stepInvoiceSettled ? "is-done" : ""}`}>2b. 入金</span>
              <span className={`fm-step-chip ${stepPaymentDone ? "is-done" : nextAction.step === 3 ? "is-current" : ""}`}>3. 支払</span>
              <span className={`fm-step-chip ${nextAction.step > 4 ? "is-done" : nextAction.step === 4 ? "is-current" : ""}`}>4. 書類</span>
            </div>
          </div>
          <div className="fm-quick-actions">
            <a href={nextAction.anchor} className="fm-btn">
              {nextAction.title}
            </a>
          </div>
        </section>

        {/* 3-Column Cockpit */}
        <div className="fm-cockpit">
          {/* Left Column: Estimate */}
          <section className="fm-column">
            <article id="step-estimate" className="fm-card">
              <h2>STEP 1: 見積を作る</h2>
              <p className="fm-step-note">工事項目と数量を入力して「明細追加」を押します。</p>
              <div className="fm-inline-grid">
                <label>
                  工事項目
                  <select value={masterItemId} onChange={(e) => setMasterItemId(e.target.value)} disabled={working}>
                    {masterOptions.map((w) => (
                      <option key={w.id} value={String(w.id)}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  数量
                  <input value={itemQuantity} onChange={(e) => setItemQuantity(e.target.value)} />
                </label>
                <button className="fm-btn fm-btn-primary" onClick={onAddProjectItem} disabled={working || masterOptions.length === 0}>
                  明細追加
                </button>
              </div>

              <div className="table-wrap">
                <table className="table fm-table-dense">
                  <thead>
                    <tr>
                      <th>大項目</th>
                      <th>仕様</th>
                      <th>数量</th>
                      <th>単価</th>
                      <th>金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="empty-state">明細はまだありません。上から項目を追加してください。</td>
                      </tr>
                    ) : null}
                    {projectItems.map((item) => (
                      <tr key={item.id}>
                        <td>{item.category}</td>
                        <td>{item.item_name}</td>
                        <td className="text-right">{item.quantity}{item.unit ?? ""}</td>
                        <td className="text-right">{yen(item.unit_price)}</td>
                        <td className="text-right"><strong>{yen(item.line_total)}</strong></td>
                      </tr>
                    ))}
                    {projectItems.length > 0 ? (
                      <tr className="table-total-row">
                        <td colSpan={4} className="text-right"><strong>見積合計</strong></td>
                        <td className="text-right"><strong>{yen(estimateTotal)}</strong></td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="fm-card fm-card-muted">
              <h2>案件情報</h2>
              <div className="fm-form-grid">
                <label>
                  顧客名
                  <input value={project?.customer_name ?? ""} disabled />
                </label>
                <label>
                  物件名
                  <input value={project?.project_name ?? ""} disabled />
                </label>
                <label>
                  施工住所
                  <input value={project?.site_address ?? ""} disabled />
                </label>
                <label>
                  管理担当
                  <input value={project?.owner_name ?? ""} disabled />
                </label>
                <label>
                  目標粗利率
                  <input value={`${targetMarginRate.toFixed(1)}%`} disabled />
                </label>
                <label>
                  作成日
                  <input value={project?.created_at ?? ""} disabled />
                </label>
              </div>
            </article>
          </section>

          {/* Center Column: Invoice / Settlement */}
          <section className="fm-column">
            <article id="step-invoice" className="fm-card">
              <h2>STEP 2: 請求・入金</h2>
              <div className="fm-split">
                <div className="fm-subcard">
                  <p className="fm-subcard-title">新規請求</p>
                  <label>
                    請求種別
                    <input value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)} />
                  </label>
                  <label>
                    請求額
                    <input value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} />
                  </label>
                  <label>
                    請求日
                    <input type="date" value={invoiceBilledAt} onChange={(e) => setInvoiceBilledAt(e.target.value)} />
                  </label>
                  <label>
                    初回入金額
                    <input value={invoicePaidAmount} onChange={(e) => setInvoicePaidAmount(e.target.value)} />
                  </label>
                  <button className="fm-btn fm-btn-primary" onClick={onAddInvoice} disabled={working}>
                    請求を登録
                  </button>
                </div>
                <div className="fm-subcard">
                  <p className="fm-subcard-title">入金反映</p>
                  <label>
                    対象請求ID
                    <select
                      value={invoiceToUpdate}
                      onChange={(e) => {
                        setInvoiceToUpdate(e.target.value);
                        const matched = invoices.find((x) => x.invoice_id === e.target.value);
                        if (matched) setInvoicePaidToUpdate(String(matched.paid_amount));
                      }}
                      disabled={working || invoices.length === 0}
                    >
                      {invoices.length === 0 ? <option value="">請求データなし</option> : null}
                      {invoices.map((inv) => (
                        <option key={inv.invoice_id} value={inv.invoice_id}>
                          {inv.invoice_id} / 残{yen(inv.remaining_amount)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    更新後入金額
                    <input value={invoicePaidToUpdate} onChange={(e) => setInvoicePaidToUpdate(e.target.value)} />
                  </label>
                  <button className="fm-btn fm-btn-primary" onClick={onSettleInvoice} disabled={working || !invoiceToUpdate}>
                    入金を反映
                  </button>
                  {activeInvoice ? (
                    <p className="fm-row-note">
                      選択中: {activeInvoice.invoice_id} / {activeInvoice.status ?? "-"}
                    </p>
                  ) : null}
                </div>
              </div>
            </article>

            <article className="fm-card">
              <h2>請求・入金サマリー</h2>
              <div className="fm-mini-metrics">
                <article className="fm-mini-card">
                  <span>請求件数</span>
                  <strong>{invoices.length} 件</strong>
                </article>
                <article className="fm-mini-card">
                  <span>未回収残</span>
                  <strong className={invoiceRemaining > 0 ? "text-warn" : ""}>{yen(invoiceRemaining)}</strong>
                </article>
                <article className="fm-mini-card">
                  <span>入金済</span>
                  <strong className="text-ok">{yen(settledSales)}</strong>
                </article>
              </div>

              <div className="table-wrap">
                <table className="table fm-table-dense">
                  <thead>
                    <tr>
                      <th>請求ID</th>
                      <th>種別</th>
                      <th>請求額</th>
                      <th>残額</th>
                      <th>状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="empty-state">請求データはまだありません。</td>
                      </tr>
                    ) : null}
                    {invoices.map((inv) => (
                      <tr key={inv.invoice_id} className={inv.remaining_amount > 0 ? "row-alert" : ""}>
                        <td><span className="id-mono">{inv.invoice_id}</span></td>
                        <td>{inv.invoice_type ?? "-"}</td>
                        <td className="text-right">{yen(inv.invoice_amount)}</td>
                        <td className="text-right">{yen(inv.remaining_amount)}</td>
                        <td>{inv.status ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>

          {/* Right Column: Payment / Docs / Log */}
          <aside className="fm-column">
            <article id="step-payment" className="fm-card">
              <h2>STEP 3: 支払・消込</h2>
              <div className="fm-split">
                <div className="fm-subcard">
                  <p className="fm-subcard-title">新規支払</p>
                  <label>
                    業者名
                    <input value={paymentVendorName} onChange={(e) => setPaymentVendorName(e.target.value)} />
                  </label>
                  <label>
                    発注額
                    <input value={paymentOrderedAmount} onChange={(e) => setPaymentOrderedAmount(e.target.value)} />
                  </label>
                  <label>
                    支払額
                    <input value={paymentPaidAmount} onChange={(e) => setPaymentPaidAmount(e.target.value)} />
                  </label>
                  <button className="fm-btn fm-btn-primary" onClick={onAddPayment} disabled={working}>
                    支払を登録
                  </button>
                </div>
                <div className="fm-subcard">
                  <p className="fm-subcard-title">支払消込</p>
                  <label>
                    対象支払ID
                    <select
                      value={paymentToUpdate}
                      onChange={(e) => {
                        setPaymentToUpdate(e.target.value);
                        const matched = payments.find((x) => x.payment_id === e.target.value);
                        if (matched) setPaymentPaidToUpdate(String(matched.paid_amount));
                      }}
                      disabled={working || payments.length === 0}
                    >
                      {payments.length === 0 ? <option value="">支払データなし</option> : null}
                      {payments.map((pay) => (
                        <option key={pay.payment_id} value={pay.payment_id}>
                          {pay.payment_id} / 残{yen(pay.remaining_amount)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    更新後支払額
                    <input value={paymentPaidToUpdate} onChange={(e) => setPaymentPaidToUpdate(e.target.value)} />
                  </label>
                  <button className="fm-btn fm-btn-primary" onClick={onSettlePayment} disabled={working || !paymentToUpdate}>
                    消込を反映
                  </button>
                  {activePayment ? (
                    <p className="fm-row-note">
                      選択中: {activePayment.payment_id} / {activePayment.status ?? "-"}
                    </p>
                  ) : null}
                </div>
              </div>
              {payments.length > 0 ? (
                <div className="table-wrap">
                  <table className="table fm-table-dense">
                    <thead>
                      <tr>
                        <th>支払ID</th>
                        <th>業者</th>
                        <th>発注額</th>
                        <th>残額</th>
                        <th>状態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((pay) => (
                        <tr key={pay.payment_id} className={pay.remaining_amount > 0 ? "row-alert" : ""}>
                          <td><span className="id-mono">{pay.payment_id}</span></td>
                          <td>{pay.vendor_name ?? "-"}</td>
                          <td className="text-right">{yen(pay.ordered_amount)}</td>
                          <td className="text-right">{yen(pay.remaining_amount)}</td>
                          <td>{pay.status ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </article>

            <article id="step-docs" className="fm-card">
              <h2>STEP 4: 書類発行・連絡</h2>
              <p className="fm-step-note">帳票を出力するとプレビューに表示されます。</p>
              <div className="fm-doc-actions">
                <button className="fm-btn fm-btn-primary" onClick={onExportEstimate} disabled={working}>
                  見積書PDF
                </button>
                <button className="fm-btn" onClick={onExportReceipt} disabled={working || !invoiceIdForPdf}>
                  領収書PDF
                </button>
                <button className="fm-btn fm-btn-ghost" onClick={onDraftInvoiceMail} disabled={working || invoices.length === 0}>
                  請求メール
                </button>
              </div>
              <label>
                領収書対象請求ID
                <select value={invoiceIdForPdf} onChange={(e) => setInvoiceIdForPdf(e.target.value)} disabled={working}>
                  {invoices.length === 0 ? <option value="">請求データなし</option> : null}
                  {invoices.map((inv) => (
                    <option key={inv.invoice_id} value={inv.invoice_id}>
                      {inv.invoice_id} / 入金 {yen(inv.paid_amount)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="fm-preview-meta">
                <strong>帳票プレビュー（A4横）</strong>
                <span>{previewTitle || "未出力"}</span>
              </div>
              <div className="fm-preview-shell">
                {previewLoading ? (
                  <p className="fm-row-note">帳票を生成中...</p>
                ) : previewUrl ? (
                  <iframe title={previewTitle || "帳票プレビュー"} src={previewUrl} />
                ) : (
                  <p className="fm-row-note">見積書PDFまたは領収書PDFを出力すると、ここにプレビューが表示されます。</p>
                )}
              </div>
            </article>

            <article className="fm-card">
              <h2>変更履歴（監査ログ）</h2>
              {auditLogs.length === 0 ? (
                <p className="fm-row-note">操作を実行すると履歴が保存されます。</p>
              ) : null}
              <ul className="fm-audit-list">
                {auditLogs.map((row) => (
                  <li key={row.id}>
                    <div className="fm-audit-head">
                      <span className={`fm-audit-cat ${CATEGORY_COLORS[row.category] ?? ""}`}>{row.category}</span>
                      <strong>{row.action}</strong>
                      <time>{new Date(row.created_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
                    </div>
                    <p className="fm-row-note">{row.detail}</p>
                  </li>
                ))}
              </ul>
            </article>
          </aside>
        </div>
      </section>

      {message ? (
        <p className={`message ${messageType === "error" ? "message-error" : ""} ${messageType === "success" ? "message-success" : ""}`}>
          {message}
        </p>
      ) : null}
    </main>
  );
}
