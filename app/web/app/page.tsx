"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  createInvoice,
  createPayment,
  createProject,
  createProjectItem,
  downloadBlob,
  exportEstimate,
  exportReceipt,
  getCustomers,
  getInvoices,
  getPayments,
  getProjectItems,
  getProjects,
  getWorkItems,
  syncExcel,
  syncExcelUpload,
  updateInvoice,
  updatePayment,
  type Invoice,
  type Payment,
  type Project,
  type ProjectItem,
  type WorkItemMaster,
} from "../lib/api";

type Customer = {
  customer_id: string;
  customer_name: string;
};

export default function HomePage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [workItems, setWorkItems] = useState<WorkItemMaster[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [projectItems, setProjectItems] = useState<ProjectItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState("");

  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingWorkItems, setLoadingWorkItems] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [customerId, setCustomerId] = useState("C-001");
  const [projectName, setProjectName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [ownerName, setOwnerName] = useState("吉野博");
  const [marginRate, setMarginRate] = useState("0.25");

  const [masterItemId, setMasterItemId] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");

  const [invoiceAmount, setInvoiceAmount] = useState("100000");
  const [invoicePaidAmount, setInvoicePaidAmount] = useState("0");
  const [invoiceType, setInvoiceType] = useState("一括");

  const [paymentVendorName, setPaymentVendorName] = useState("テスト業者");
  const [paymentOrderedAmount, setPaymentOrderedAmount] = useState("50000");
  const [paymentPaidAmount, setPaymentPaidAmount] = useState("0");

  const [invoiceToUpdate, setInvoiceToUpdate] = useState("");
  const [invoicePaidToUpdate, setInvoicePaidToUpdate] = useState("0");
  const [paymentToUpdate, setPaymentToUpdate] = useState("");
  const [paymentPaidToUpdate, setPaymentPaidToUpdate] = useState("0");

  const [invoiceIdForPdf, setInvoiceIdForPdf] = useState("");

  const [syncWorkbookPath, setSyncWorkbookPath] = useState("");
  const [syncWorkbookFile, setSyncWorkbookFile] = useState<File | null>(null);

  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  const yen = (value: number) => `¥${Math.round(value).toLocaleString()}`;

  const selectedProject = useMemo(
    () => projects.find((p) => p.project_id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const masterOptions = useMemo(
    () => workItems.map((w) => ({ id: w.id, label: `${w.category} / ${w.item_name} / ¥${w.standard_unit_price}` })),
    [workItems],
  );

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

  const grossForecast = invoiceTotal - paymentTotal;

  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const data = await getCustomers();
      setCustomers(data);
      if (data.length > 0 && !data.find((c: Customer) => c.customer_id === customerId)) {
        setCustomerId(data[0].customer_id);
      }
    } finally {
      setLoadingCustomers(false);
    }
  };

  const loadWorkItems = async () => {
    setLoadingWorkItems(true);
    try {
      const data = await getWorkItems();
      setWorkItems(data);
      if (data.length > 0 && !masterItemId) {
        setMasterItemId(String(data[0].id));
      }
    } finally {
      setLoadingWorkItems(false);
    }
  };

  const loadProjects = async (preferredProjectId?: string) => {
    setLoadingProjects(true);
    try {
      const data = await getProjects();
      const sorted = [...data.items].sort((a, b) => b.created_at.localeCompare(a.created_at));
      setProjects(sorted);

      let nextProjectId = preferredProjectId ?? selectedProjectId;
      if (!nextProjectId || !sorted.some((p) => p.project_id === nextProjectId)) {
        nextProjectId = sorted[0]?.project_id ?? "";
      }
      setSelectedProjectId(nextProjectId);
      return nextProjectId;
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadProjectItems = async (projectId: string) => {
    const rows = await getProjectItems(projectId);
    setProjectItems(rows);
  };

  const loadFinance = async (projectId: string) => {
    const [invoiceRows, paymentRows] = await Promise.all([getInvoices(projectId), getPayments(projectId)]);
    setInvoices(invoiceRows);
    setPayments(paymentRows);

    const invoiceForSettle = invoiceRows.find((x) => x.invoice_id === invoiceToUpdate) ?? invoiceRows[0];
    if (invoiceForSettle) {
      setInvoiceToUpdate(invoiceForSettle.invoice_id);
      setInvoicePaidToUpdate(String(invoiceForSettle.paid_amount));
    } else {
      setInvoiceToUpdate("");
      setInvoicePaidToUpdate("0");
    }

    const invoiceForPdf = invoiceRows.find((x) => x.invoice_id === invoiceIdForPdf) ?? invoiceRows[0];
    setInvoiceIdForPdf(invoiceForPdf?.invoice_id ?? "");

    const paymentForSettle = paymentRows.find((x) => x.payment_id === paymentToUpdate) ?? paymentRows[0];
    if (paymentForSettle) {
      setPaymentToUpdate(paymentForSettle.payment_id);
      setPaymentPaidToUpdate(String(paymentForSettle.paid_amount));
    } else {
      setPaymentToUpdate("");
      setPaymentPaidToUpdate("0");
    }
  };

  const loadWorkspace = async (projectId: string) => {
    await Promise.all([loadProjectItems(projectId), loadFinance(projectId)]);
  };

  useEffect(() => {
    (async () => {
      setWorking(true);
      try {
        await Promise.all([loadCustomers(), loadWorkItems()]);
        const initialProjectId = await loadProjects();
        if (initialProjectId) {
          await loadWorkspace(initialProjectId);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "初期読み込みに失敗しました");
      } finally {
        setWorking(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSelectProject = async (projectId: string) => {
    setSelectedProjectId(projectId);
    if (!projectId) {
      setProjectItems([]);
      setInvoices([]);
      setPayments([]);
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      await loadWorkspace(projectId);
      setMessage(`操作対象案件を ${projectId} に切り替えました`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "案件データの読み込みに失敗しました");
    } finally {
      setWorking(false);
    }
  };

  const onCreateProject = async () => {
    if (!projectName.trim()) {
      setMessage("物件名を入力してください");
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      const created = await createProject({
        customer_id: customerId,
        project_name: projectName,
        site_address: siteAddress,
        owner_name: ownerName,
        target_margin_rate: Number(marginRate || "0.25"),
      });

      const activeProjectId = await loadProjects(created.project_id);
      if (activeProjectId) {
        await loadWorkspace(activeProjectId);
      }

      setProjectName("");
      setSiteAddress("");
      setMessage(`案件を作成しました: ${created.project_id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "案件作成に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  const onAddProjectItem = async () => {
    if (!selectedProjectId.trim()) {
      setMessage("先に案件を選択してください");
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      await createProjectItem(selectedProjectId, {
        master_item_id: masterItemId ? Number(masterItemId) : undefined,
        quantity: Number(itemQuantity || "1"),
      });
      await loadProjectItems(selectedProjectId);
      setMessage("案件明細を追加しました");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "案件明細追加に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  const onAddInvoice = async () => {
    if (!selectedProjectId.trim()) {
      setMessage("先に案件を選択してください");
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      const created = await createInvoice({
        project_id: selectedProjectId,
        invoice_amount: Number(invoiceAmount || "0"),
        paid_amount: Number(invoicePaidAmount || "0"),
        invoice_type: invoiceType,
      });
      await loadFinance(selectedProjectId);
      setInvoiceIdForPdf(created.invoice_id);
      setMessage(`請求を登録しました: ${created.invoice_id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "請求登録に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  const onAddPayment = async () => {
    if (!selectedProjectId.trim()) {
      setMessage("先に案件を選択してください");
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      const created = await createPayment({
        project_id: selectedProjectId,
        vendor_name: paymentVendorName,
        ordered_amount: Number(paymentOrderedAmount || "0"),
        paid_amount: Number(paymentPaidAmount || "0"),
        status: "❌未支払",
      });
      await loadFinance(selectedProjectId);
      setMessage(`支払を登録しました: ${created.payment_id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "支払登録に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  const onSettleInvoice = async () => {
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
      await loadFinance(updated.project_id);
      setInvoiceIdForPdf(updated.invoice_id);
      setMessage(`請求を更新しました: ${updated.invoice_id} / ${updated.status}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "請求更新に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  const onSettlePayment = async () => {
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
      await loadFinance(updated.project_id);
      setMessage(`支払を更新しました: ${updated.payment_id} / ${updated.status}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "支払更新に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  const onExportEstimate = async () => {
    if (!selectedProjectId) {
      setMessage("先に案件を選択してください");
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      const { blob } = await exportEstimate(selectedProjectId);
      downloadBlob(blob, `estimate_${selectedProjectId}.pdf`);
      setMessage(`見積書PDFを出力しました: ${selectedProjectId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "見積書PDF出力に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  const onExportReceipt = async () => {
    if (!invoiceIdForPdf) {
      setMessage("対象の請求IDを選択してください");
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      const { blob } = await exportReceipt(invoiceIdForPdf);
      downloadBlob(blob, `receipt_${invoiceIdForPdf}.pdf`);
      setMessage(`領収書PDFを出力しました: ${invoiceIdForPdf}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "領収書PDF出力に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  const onReloadWorkspace = async () => {
    if (!selectedProjectId) {
      setMessage("先に案件を選択してください");
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      await Promise.all([loadProjects(selectedProjectId), loadWorkspace(selectedProjectId)]);
      setMessage(`案件 ${selectedProjectId} を再読込しました`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "再読込に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  const onSyncExcel = async () => {
    setWorking(true);
    setMessage("");
    try {
      const result = syncWorkbookFile
        ? await syncExcelUpload(syncWorkbookFile)
        : await syncExcel(syncWorkbookPath.trim() || undefined);

      await Promise.all([loadCustomers(), loadWorkItems()]);
      const nextProjectId = await loadProjects(selectedProjectId);
      if (nextProjectId) {
        await loadWorkspace(nextProjectId);
      }

      setMessage(
        `同期完了: 顧客${result.customers_upserted} / 案件${result.projects_upserted} / 請求${result.invoices_upserted} / 支払${result.payments_upserted} / 項目${result.work_items_upserted}`,
      );
      setSyncWorkbookFile(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Excel同期に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-head">
          <Image src="/link-logo.svg" alt="LinKロゴ" width={144} height={144} className="hero-logo" priority />
        </div>
        <p className="eyebrow">LinK Estimate System</p>
        <h1>案件ワークスペース</h1>
        <p className="sub">案件を1つ選び、その案件に対して見積・請求・支払・消込・PDF出力をまとめて操作します。</p>
      </section>

      <section className="panel project-summary">
        <div className="project-summary-head">
          <h2>操作対象案件</h2>
          <button onClick={onReloadWorkspace} disabled={working || !selectedProjectId}>
            案件データを再読込
          </button>
        </div>

        <label>
          案件を選択
          <select
            value={selectedProjectId}
            onChange={(e) => {
              void onSelectProject(e.target.value);
            }}
            disabled={loadingProjects || working}
          >
            {projects.length === 0 ? <option value="">案件がありません</option> : null}
            {projects.map((p) => (
              <option key={p.project_id} value={p.project_id}>
                {p.project_id} / {p.project_name} / {p.customer_name}
              </option>
            ))}
          </select>
        </label>

        <div className="project-tags">
          <span className="tag">顧客: {selectedProject?.customer_name ?? "-"}</span>
          <span className="tag">ステータス: {selectedProject?.project_status ?? "-"}</span>
          <span className="tag">担当者: {selectedProject?.owner_name ?? "-"}</span>
          <span className="tag">住所: {selectedProject?.site_address ?? "-"}</span>
        </div>

        <div className="overview-grid">
          <article className="mini-kpi">
            <p className="mini-label">見積明細合計</p>
            <p className="mini-value">{yen(estimateTotal)}</p>
          </article>
          <article className="mini-kpi">
            <p className="mini-label">請求合計 / 未回収</p>
            <p className="mini-value">
              {yen(invoiceTotal)} / {yen(invoiceRemaining)}
            </p>
          </article>
          <article className="mini-kpi">
            <p className="mini-label">支払合計 / 未払</p>
            <p className="mini-value">
              {yen(paymentTotal)} / {yen(paymentRemaining)}
            </p>
          </article>
          <article className="mini-kpi">
            <p className="mini-label">粗利見込（請求-支払）</p>
            <p className="mini-value">{yen(grossForecast)}</p>
          </article>
        </div>
      </section>

      <section className="workspace-grid">
        <article className="panel">
          <h2>新規案件作成</h2>
          <label>
            顧客ID
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              disabled={loadingCustomers || working}
            >
              {customers.map((c) => (
                <option key={c.customer_id} value={c.customer_id}>
                  {c.customer_id} / {c.customer_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            物件名
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
          </label>
          <label>
            施工住所
            <input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} />
          </label>
          <label>
            担当者
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </label>
          <label>
            目標粗利率
            <input value={marginRate} onChange={(e) => setMarginRate(e.target.value)} />
          </label>
          <button onClick={onCreateProject} disabled={working || loadingCustomers}>
            案件を作成
          </button>
        </article>

        <article className="panel">
          <h2>案件明細登録</h2>
          <p className="context-chip">対象案件: {selectedProjectId || "未選択"}</p>
          <label>
            工事項目
            <select
              value={masterItemId}
              onChange={(e) => setMasterItemId(e.target.value)}
              disabled={loadingWorkItems || working}
            >
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
          <button onClick={onAddProjectItem} disabled={working || loadingWorkItems || !selectedProjectId}>
            明細を追加
          </button>
          <div className="items-box">
            {projectItems.length === 0 ? <p className="item-row">明細はまだありません</p> : null}
            {projectItems.slice(0, 8).map((item) => (
              <p key={item.id} className="item-row">
                {item.category} / {item.item_name} / {item.quantity} / ¥{item.line_total.toLocaleString()}
              </p>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>請求登録</h2>
          <p className="context-chip">対象案件: {selectedProjectId || "未選択"}</p>
          <label>
            請求種別
            <input value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)} />
          </label>
          <label>
            請求額
            <input value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} />
          </label>
          <label>
            入金額
            <input value={invoicePaidAmount} onChange={(e) => setInvoicePaidAmount(e.target.value)} />
          </label>
          <button onClick={onAddInvoice} disabled={working || !selectedProjectId}>
            請求を登録
          </button>
        </article>

        <article className="panel">
          <h2>請求消込更新</h2>
          <p className="context-chip">対象案件: {selectedProjectId || "未選択"}</p>
          <label>
            請求ID
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
                  {inv.invoice_id} / 残¥{inv.remaining_amount.toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <label>
            更新後入金額
            <input value={invoicePaidToUpdate} onChange={(e) => setInvoicePaidToUpdate(e.target.value)} />
          </label>
          <button onClick={onSettleInvoice} disabled={working || !invoiceToUpdate}>
            請求を更新
          </button>
        </article>

        <article className="panel">
          <h2>支払登録</h2>
          <p className="context-chip">対象案件: {selectedProjectId || "未選択"}</p>
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
          <button onClick={onAddPayment} disabled={working || !selectedProjectId}>
            支払を登録
          </button>
        </article>

        <article className="panel">
          <h2>支払消込更新</h2>
          <p className="context-chip">対象案件: {selectedProjectId || "未選択"}</p>
          <label>
            支払ID
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
                  {pay.payment_id} / 残¥{pay.remaining_amount.toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <label>
            更新後支払額
            <input value={paymentPaidToUpdate} onChange={(e) => setPaymentPaidToUpdate(e.target.value)} />
          </label>
          <button onClick={onSettlePayment} disabled={working || !paymentToUpdate}>
            支払を更新
          </button>
        </article>

        <article className="panel">
          <h2>帳票出力</h2>
          <p className="context-chip">対象案件: {selectedProjectId || "未選択"}</p>
          <button onClick={onExportEstimate} disabled={working || !selectedProjectId}>
            見積書PDFを出力
          </button>
          <label>
            領収書の請求ID
            <select
              value={invoiceIdForPdf}
              onChange={(e) => setInvoiceIdForPdf(e.target.value)}
              disabled={working || invoices.length === 0}
            >
              {invoices.length === 0 ? <option value="">請求データなし</option> : null}
              {invoices.map((inv) => (
                <option key={inv.invoice_id} value={inv.invoice_id}>
                  {inv.invoice_id} / 入金¥{inv.paid_amount.toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <button onClick={onExportReceipt} disabled={working || !invoiceIdForPdf}>
            領収書PDFを出力
          </button>
        </article>

        <article className="panel">
          <h2>案件内の請求/支払一覧</h2>
          <p className="context-chip">対象案件: {selectedProjectId || "未選択"}</p>
          <div className="items-box">
            {invoices.length === 0 && payments.length === 0 ? <p className="item-row">データはまだありません</p> : null}
            {invoices.slice(0, 6).map((inv) => (
              <p key={inv.invoice_id} className="item-row">
                請求 {inv.invoice_id} / ¥{inv.invoice_amount.toLocaleString()} / 残¥
                {inv.remaining_amount.toLocaleString()} / {inv.status ?? "-"}
              </p>
            ))}
            {payments.slice(0, 6).map((pay) => (
              <p key={pay.payment_id} className="item-row">
                支払 {pay.payment_id} / {pay.vendor_name ?? "-"} / 残¥{pay.remaining_amount.toLocaleString()} / {pay.status ?? "-"}
              </p>
            ))}
          </div>
        </article>
      </section>

      <section className="panel admin-panel">
        <h2>管理メニュー（Excel同期）</h2>
        <p className="item-row">通常運用では不要です。初期データ取り込み時だけ使ってください。</p>
        <label>
          ローカル開発用パス（通常は空欄）
          <input
            value={syncWorkbookPath}
            onChange={(e) => setSyncWorkbookPath(e.target.value)}
            placeholder="/path/to/見積原価管理システム.xlsm"
          />
        </label>
        <label>
          Excelファイルを選択（推奨）
          <input
            type="file"
            accept=".xlsx,.xlsm,.xltx,.xltm"
            onChange={(e) => setSyncWorkbookFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button onClick={onSyncExcel} disabled={working}>
          取り込み実行
        </button>
      </section>

      {message ? <p className="message">{message}</p> : null}
    </main>
  );
}
