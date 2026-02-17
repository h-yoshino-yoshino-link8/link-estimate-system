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
  getDashboardOverview,
  getInvoices,
  getPayments,
  getProjectItems,
  getWorkItems,
  syncExcel,
  syncExcelUpload,
  updateInvoice,
  updatePayment,
  type DashboardOverview,
  type Invoice,
  type Payment,
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
  const [projectItems, setProjectItems] = useState<ProjectItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);

  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingWorkItems, setLoadingWorkItems] = useState(true);

  const [customerId, setCustomerId] = useState("C-001");
  const [projectName, setProjectName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [ownerName, setOwnerName] = useState("吉野博");
  const [marginRate, setMarginRate] = useState("0.25");

  const [projectIdForPdf, setProjectIdForPdf] = useState("P-003");
  const [invoiceIdForPdf, setInvoiceIdForPdf] = useState("INV-001");

  const [syncWorkbookPath, setSyncWorkbookPath] = useState("");
  const [syncWorkbookFile, setSyncWorkbookFile] = useState<File | null>(null);

  const [projectIdForItem, setProjectIdForItem] = useState("P-003");
  const [masterItemId, setMasterItemId] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");

  const [projectIdForInvoice, setProjectIdForInvoice] = useState("P-003");
  const [invoiceAmount, setInvoiceAmount] = useState("100000");
  const [invoicePaidAmount, setInvoicePaidAmount] = useState("0");
  const [invoiceType, setInvoiceType] = useState("一括");

  const [projectIdForPayment, setProjectIdForPayment] = useState("P-003");
  const [paymentVendorName, setPaymentVendorName] = useState("テスト業者");
  const [paymentOrderedAmount, setPaymentOrderedAmount] = useState("50000");
  const [paymentPaidAmount, setPaymentPaidAmount] = useState("0");

  const [invoiceToUpdate, setInvoiceToUpdate] = useState("");
  const [invoicePaidToUpdate, setInvoicePaidToUpdate] = useState("0");
  const [paymentToUpdate, setPaymentToUpdate] = useState("");
  const [paymentPaidToUpdate, setPaymentPaidToUpdate] = useState("0");

  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  const yen = (value: number) => `¥${Math.round(value).toLocaleString()}`;

  const masterOptions = useMemo(
    () => workItems.map((w) => ({ id: w.id, label: `${w.category} / ${w.item_name} / ¥${w.standard_unit_price}` })),
    [workItems],
  );

  const pendingInvoices = useMemo(
    () =>
      allInvoices
        .filter((x) => x.remaining_amount > 0)
        .sort((a, b) => b.remaining_amount - a.remaining_amount)
        .slice(0, 6),
    [allInvoices],
  );

  const pendingPayments = useMemo(
    () =>
      allPayments
        .filter((x) => x.remaining_amount > 0)
        .sort((a, b) => b.remaining_amount - a.remaining_amount)
        .slice(0, 6),
    [allPayments],
  );

  const totalInvoiceAmount = useMemo(
    () => allInvoices.reduce((sum, row) => sum + Number(row.invoice_amount || 0), 0),
    [allInvoices],
  );

  const totalPaymentAmount = useMemo(
    () => allPayments.reduce((sum, row) => sum + Number(row.ordered_amount || 0), 0),
    [allPayments],
  );

  const invoiceCollectionRate = useMemo(() => {
    const total = totalInvoiceAmount;
    const remaining = overview?.receivable_balance ?? 0;
    if (total <= 0) return 0;
    return Math.max(0, Math.min(100, ((total - remaining) / total) * 100));
  }, [overview, totalInvoiceAmount]);

  const paymentSettlementRate = useMemo(() => {
    const total = totalPaymentAmount;
    const remaining = overview?.payable_balance ?? 0;
    if (total <= 0) return 0;
    return Math.max(0, Math.min(100, ((total - remaining) / total) * 100));
  }, [overview, totalPaymentAmount]);

  const grossSpread = useMemo(() => totalInvoiceAmount - totalPaymentAmount, [totalInvoiceAmount, totalPaymentAmount]);

  const monthlySalesPoints = overview?.monthly_sales_current_year ?? [];
  const monthlyPeak = useMemo(
    () => (monthlySalesPoints.length > 0 ? Math.max(...monthlySalesPoints.map((x) => x.amount), 1) : 1),
    [monthlySalesPoints],
  );
  const growthRate = overview?.yoy_growth_rate ?? 0;
  const growthText = `${growthRate >= 0 ? "+" : ""}${growthRate.toFixed(1)}%`;

  const loadCustomers = async () => {
    const data = await getCustomers();
    setCustomers(data);
    if (data.length > 0 && !data.find((c: Customer) => c.customer_id === customerId)) {
      setCustomerId(data[0].customer_id);
    }
  };

  const loadWorkItems = async () => {
    const data = await getWorkItems();
    setWorkItems(data);
    if (data.length > 0 && !masterItemId) {
      setMasterItemId(String(data[0].id));
    }
  };

  const loadProjectItems = async (targetProjectId: string) => {
    const items = await getProjectItems(targetProjectId);
    setProjectItems(items);
  };

  const loadFinance = async (targetProjectId: string) => {
    const [invoiceRows, paymentRows] = await Promise.all([getInvoices(targetProjectId), getPayments(targetProjectId)]);
    setInvoices(invoiceRows);
    setPayments(paymentRows);

    const selectedInvoice = invoiceRows.find((x) => x.invoice_id === invoiceToUpdate);
    if (selectedInvoice) {
      setInvoicePaidToUpdate(String(selectedInvoice.paid_amount));
    } else if (invoiceRows.length > 0) {
      setInvoiceToUpdate(invoiceRows[0].invoice_id);
      setInvoicePaidToUpdate(String(invoiceRows[0].paid_amount));
    } else {
      setInvoiceToUpdate("");
      setInvoicePaidToUpdate("0");
    }

    const selectedPayment = paymentRows.find((x) => x.payment_id === paymentToUpdate);
    if (selectedPayment) {
      setPaymentPaidToUpdate(String(selectedPayment.paid_amount));
    } else if (paymentRows.length > 0) {
      setPaymentToUpdate(paymentRows[0].payment_id);
      setPaymentPaidToUpdate(String(paymentRows[0].paid_amount));
    } else {
      setPaymentToUpdate("");
      setPaymentPaidToUpdate("0");
    }
  };

  const loadOverview = async () => {
    const [overviewData, invoiceRows, paymentRows] = await Promise.all([
      getDashboardOverview(),
      getInvoices(),
      getPayments(),
    ]);
    setOverview(overviewData);
    setAllInvoices(invoiceRows);
    setAllPayments(paymentRows);
  };

  useEffect(() => {
    (async () => {
      try {
        await loadCustomers();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "顧客取得に失敗しました");
      } finally {
        setLoadingCustomers(false);
      }
    })();

    (async () => {
      try {
        await loadWorkItems();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "工事項目取得に失敗しました");
      } finally {
        setLoadingWorkItems(false);
      }
    })();

    (async () => {
      try {
        await loadProjectItems("P-003");
        await loadFinance("P-003");
        await loadOverview();
      } catch {
        // ignore initial load errors
      }
    })();
  }, []);

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
      setProjectIdForPdf(created.project_id);
      setProjectIdForItem(created.project_id);
      setProjectIdForInvoice(created.project_id);
      setProjectIdForPayment(created.project_id);
      setMessage(`案件を作成しました: ${created.project_id} / ${created.project_sheet_name}`);
      setProjectName("");
      setSiteAddress("");
      await loadProjectItems(created.project_id);
      await loadFinance(created.project_id);
      await loadOverview();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "案件作成に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  const onExportEstimate = async () => {
    setWorking(true);
    setMessage("");
    try {
      const { blob } = await exportEstimate(projectIdForPdf);
      downloadBlob(blob, `estimate_${projectIdForPdf}.pdf`);
      setMessage("見積書PDFを出力しました");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "見積書PDF出力に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  const onExportReceipt = async () => {
    setWorking(true);
    setMessage("");
    try {
      const { blob } = await exportReceipt(invoiceIdForPdf);
      downloadBlob(blob, `receipt_${invoiceIdForPdf}.pdf`);
      setMessage("領収書PDFを出力しました");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "領収書PDF出力に失敗しました");
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
      await loadCustomers();
      await loadWorkItems();
      await loadFinance(projectIdForInvoice);
      await loadOverview();
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

  const onAddProjectItem = async () => {
    if (!projectIdForItem.trim()) {
      setMessage("案件IDを入力してください");
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      await createProjectItem(projectIdForItem, {
        master_item_id: masterItemId ? Number(masterItemId) : undefined,
        quantity: Number(itemQuantity || "1"),
      });
      await loadProjectItems(projectIdForItem);
      await loadOverview();
      setMessage("案件明細を追加しました");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "案件明細追加に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  const onAddInvoice = async () => {
    setWorking(true);
    setMessage("");
    try {
      const created = await createInvoice({
        project_id: projectIdForInvoice,
        invoice_amount: Number(invoiceAmount || "0"),
        paid_amount: Number(invoicePaidAmount || "0"),
        invoice_type: invoiceType,
      });
      setInvoiceIdForPdf(created.invoice_id);
      await loadFinance(projectIdForInvoice);
      await loadOverview();
      setMessage(`請求を登録しました: ${created.invoice_id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "請求登録に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  const onAddPayment = async () => {
    setWorking(true);
    setMessage("");
    try {
      const created = await createPayment({
        project_id: projectIdForPayment,
        vendor_name: paymentVendorName,
        ordered_amount: Number(paymentOrderedAmount || "0"),
        paid_amount: Number(paymentPaidAmount || "0"),
        status: "❌未支払",
      });
      await loadFinance(projectIdForPayment);
      await loadOverview();
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
      await loadOverview();
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
      await loadOverview();
      setMessage(`支払を更新しました: ${updated.payment_id} / ${updated.status}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "支払更新に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  const onReloadProjectItems = async () => {
    setWorking(true);
    setMessage("");
    try {
      await loadProjectItems(projectIdForItem);
      setMessage("案件明細を再読込しました");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "案件明細取得に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  const onReloadFinance = async () => {
    setWorking(true);
    setMessage("");
    try {
      await loadFinance(projectIdForInvoice);
      await loadOverview();
      setMessage("請求/支払一覧を再読込しました");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "請求/支払取得に失敗しました");
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
        <h1>見積・原価管理ダッシュボード</h1>
        <p className="sub">案件作成 → 見積作成 → 請求/支払管理 → PDF出力を1画面で実行します。</p>
      </section>

      <section className="guide-grid">
        <article className="panel">
          <h2>このシステムでできること</h2>
          <div className="items-box">
            <p className="item-row">1. 新規案件を作成して案件IDを発行</p>
            <p className="item-row">2. 工事項目を追加して見積金額を積み上げ</p>
            <p className="item-row">3. 請求・入金、支払・消込の残額を管理</p>
            <p className="item-row">4. 見積書・領収書PDFを出力</p>
          </div>
        </article>
        <article className="panel">
          <h2>推奨フロー（最短）</h2>
          <div className="items-box">
            <p className="item-row">Step 1: 「新規案件作成」で案件を作る</p>
            <p className="item-row">Step 2: 「案件明細登録」で見積を作る</p>
            <p className="item-row">Step 3: 「請求登録/支払登録」で原価管理する</p>
            <p className="item-row">Step 4: 「見積書PDF出力」で帳票を出す</p>
          </div>
        </article>
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
          <p className="kpi-note">今年の累計</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">現在売上累計</p>
          <p className="kpi-value">{yen(overview?.all_time_sales ?? 0)}</p>
          <p className="kpi-note">全期間累計</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">前年比成長率</p>
          <p className={`kpi-value ${growthRate >= 0 ? "kpi-growth-plus" : "kpi-growth-minus"}`}>{growthText}</p>
          <p className="kpi-note">前年同期比</p>
        </article>
      </section>

      <section className="dash-grid">
        <article className="panel">
          <h2>売上グラフ（今年）</h2>
          <div className="chart-grid">
            {monthlySalesPoints.map((point) => (
              <div key={point.month} className="chart-col">
                <div className="chart-track">
                  <span className="chart-bar" style={{ height: `${Math.max((point.amount / monthlyPeak) * 100, 2)}%` }} />
                </div>
                <p className="chart-label">{point.month}</p>
                <p className="chart-value">{yen(point.amount)}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>経営指標</h2>
          <div className="items-box">
            <p className="item-row">前年同期売上: {yen(overview?.last_year_ytd_sales ?? 0)}</p>
            <p className="item-row">請求残額（売掛）: {yen(overview?.receivable_balance ?? 0)}</p>
            <p className="item-row">支払残額（買掛）: {yen(overview?.payable_balance ?? 0)}</p>
            <p className="item-row">粗利見込: {yen(grossSpread)}</p>
            <p className="item-row">稼働案件数: {overview?.active_project_count ?? 0}</p>
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
          <button onClick={onReloadFinance} disabled={working}>
            集計を更新
          </button>
        </article>

        <article className="panel">
          <h2>稼働案件（どこが動いているか）</h2>
          <div className="items-box">
            {(overview?.active_projects ?? []).slice(0, 8).map((project) => (
              <div key={project.project_id} className="active-row">
                <p className="item-row active-title">
                  {project.project_id} / {project.project_name}
                </p>
                <p className="item-row">
                  {project.project_status} / 売上 {yen(project.invoice_total_amount)} / 原価 {yen(project.payment_total_amount)}
                </p>
              </div>
            ))}
            {(overview?.active_projects.length ?? 0) === 0 ? (
              <p className="item-row">現在稼働中の案件はありません</p>
            ) : null}
          </div>
          <h2>未消込アラート</h2>
          <div className="items-box">
            {pendingInvoices.slice(0, 3).map((inv) => (
              <p key={inv.invoice_id} className="item-row">
                請求 {inv.invoice_id}: 残{yen(inv.remaining_amount)}
              </p>
            ))}
            {pendingPayments.slice(0, 3).map((pay) => (
              <p key={pay.payment_id} className="item-row">
                支払 {pay.payment_id}: 残{yen(pay.remaining_amount)}
              </p>
            ))}
            {pendingInvoices.length === 0 && pendingPayments.length === 0 ? <p className="item-row">未消込はありません</p> : null}
          </div>
        </article>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>初期データ取り込み（Excel）</h2>
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
        </article>

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
          <label>
            案件ID
            <input value={projectIdForItem} onChange={(e) => setProjectIdForItem(e.target.value)} />
          </label>
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
          <button onClick={onAddProjectItem} disabled={working || loadingWorkItems}>
            明細を追加
          </button>
          <button onClick={onReloadProjectItems} disabled={working}>
            明細を再読込
          </button>
          <div className="items-box">
            {projectItems.slice(0, 8).map((item) => (
              <p key={item.id} className="item-row">
                {item.category} / {item.item_name} / {item.quantity} / ¥{item.line_total.toLocaleString()}
              </p>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>請求登録</h2>
          <label>
            案件ID
            <input value={projectIdForInvoice} onChange={(e) => setProjectIdForInvoice(e.target.value)} />
          </label>
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
          <button onClick={onAddInvoice} disabled={working}>
            請求を登録
          </button>
        </article>

        <article className="panel">
          <h2>支払登録</h2>
          <label>
            案件ID
            <input value={projectIdForPayment} onChange={(e) => setProjectIdForPayment(e.target.value)} />
          </label>
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
          <button onClick={onAddPayment} disabled={working}>
            支払を登録
          </button>
        </article>

        <article className="panel">
          <h2>請求消込更新</h2>
          <label>
            請求ID
            <select
              value={invoiceToUpdate}
              onChange={(e) => {
                setInvoiceToUpdate(e.target.value);
                const matched = invoices.find((x) => x.invoice_id === e.target.value);
                if (matched) setInvoicePaidToUpdate(String(matched.paid_amount));
              }}
            >
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
          <button onClick={onSettleInvoice} disabled={working}>
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
                const matched = payments.find((x) => x.payment_id === e.target.value);
                if (matched) setPaymentPaidToUpdate(String(matched.paid_amount));
              }}
            >
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
          <button onClick={onSettlePayment} disabled={working}>
            支払を更新
          </button>
        </article>

        <article className="panel">
          <h2>請求/支払一覧</h2>
          <button onClick={onReloadFinance} disabled={working}>
            一覧を再読込
          </button>
          <div className="items-box">
            {invoices.slice(0, 5).map((inv) => (
              <p key={inv.invoice_id} className="item-row">
                請求 {inv.invoice_id} / ¥{inv.invoice_amount.toLocaleString()} / 残¥
                {inv.remaining_amount.toLocaleString()} / {inv.status ?? "-"}
              </p>
            ))}
            {payments.slice(0, 5).map((pay) => (
              <p key={pay.payment_id} className="item-row">
                支払 {pay.payment_id} / {pay.vendor_name ?? "-"} / 残¥{pay.remaining_amount.toLocaleString()} / {pay.status ?? "-"}
              </p>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>見積書PDF出力</h2>
          <label>
            案件ID
            <input value={projectIdForPdf} onChange={(e) => setProjectIdForPdf(e.target.value)} />
          </label>
          <button onClick={onExportEstimate} disabled={working}>
            見積書PDFを出力
          </button>
        </article>

        <article className="panel">
          <h2>領収書PDF出力</h2>
          <label>
            請求ID
            <input value={invoiceIdForPdf} onChange={(e) => setInvoiceIdForPdf(e.target.value)} />
          </label>
          <button onClick={onExportReceipt} disabled={working}>
            領収書PDFを出力
          </button>
        </article>
      </section>

      {message ? <p className="message">{message}</p> : null}
    </main>
  );
}
