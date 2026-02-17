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
  const [localMode, setLocalMode] = useState(false);

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
  const stepEstimateDone = projectItems.length > 0;
  const stepInvoiceDone = invoices.length > 0;
  const stepInvoiceSettled = invoices.length > 0 && invoiceRemaining <= 0;
  const stepPaymentDone = payments.length > 0;

  const nextAction = useMemo(() => {
    if (!stepEstimateDone) {
      return {
        title: "STEP 1: 見積明細を1件以上追加してください",
        detail: "工事項目と数量を入力して「明細追加」を押してください。",
      };
    }
    if (!stepInvoiceDone) {
      return {
        title: "STEP 2: 請求を登録してください",
        detail: "請求額を入力し「請求を登録」で請求IDを発行します。",
      };
    }
    if (!stepInvoiceSettled) {
      return {
        title: "STEP 2: 入金反映を完了してください",
        detail: "更新対象請求IDを選び、入金額を更新して未入金残を0にします。",
      };
    }
    if (!stepPaymentDone) {
      return {
        title: "STEP 3: 支払を登録してください",
        detail: "業者支払を登録し、必要に応じて支払消込を反映します。",
      };
    }
    return {
      title: "STEP 4: 書類発行と連絡へ進めます",
      detail: "見積書/領収書PDFの出力と請求メール文面作成を実行できます。",
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

  const onReload = async () => {
    setWorking(true);
    setMessage("");
    try {
      await loadWorkspace();
      setMessage("案件データを再読込しました");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "再読込に失敗しました");
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
        project_id: projectId,
        invoice_amount: Number(invoiceAmount || "0"),
        paid_amount: Number(invoicePaidAmount || "0"),
        invoice_type: invoiceType,
        billed_at: invoiceBilledAt,
      });
      await loadWorkspace();
      setInvoiceIdForPdf(created.invoice_id);
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
        project_id: projectId,
        vendor_name: paymentVendorName,
        ordered_amount: Number(paymentOrderedAmount || "0"),
        paid_amount: Number(paymentPaidAmount || "0"),
        status: "❌未支払",
      });
      await loadWorkspace();
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
      await loadWorkspace();
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
      await loadWorkspace();
      setMessage(`支払を更新しました: ${updated.payment_id} / ${updated.status}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "支払更新に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  const onExportEstimate = async () => {
    setWorking(true);
    setMessage("");
    try {
      const { blob } = await exportEstimate(projectId);
      downloadBlob(blob, `estimate_${projectId}.pdf`);
      setMessage(`見積書PDFを出力しました: ${projectId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "見積書PDF出力に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  const onExportReceipt = async () => {
    if (!invoiceIdForPdf) {
      setMessage("請求IDを選択してください");
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

  const onDraftInvoiceMail = () => {
    const selectedInvoice = invoices.find((x) => x.invoice_id === invoiceIdForPdf) ?? invoices[0];
    if (!selectedInvoice) {
      setMessage("請求データがありません");
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
    setMessage("メール文面を生成しました（メーラーが開きます）");
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
        <header className="fm-header">
          <div className="fm-title-wrap">
            <h1>案件ワークスペース</h1>
            <p>
              工事ID: <strong>{projectId}</strong> / 物件名: <strong>{project?.project_name ?? "-"}</strong>
            </p>
            <p>
              顧客: {project?.customer_name ?? "-"} / 担当: {project?.owner_name ?? "-"} / ステータス:{" "}
              {project?.project_status ?? "-"}
            </p>
          </div>
          <div className="fm-head-actions">
            <Link href="/projects" className="fm-btn fm-btn-ghost">
              案件一覧
            </Link>
            <button className="fm-btn" onClick={onReload} disabled={working}>
              再読込
            </button>
          </div>
        </header>

        <section className="fm-kpi-row">
          <article className="fm-kpi">
            <span>見積合計</span>
            <strong>{yen(estimateTotal)}</strong>
          </article>
          <article className="fm-kpi">
            <span>請求合計</span>
            <strong>{yen(invoiceTotal)}</strong>
          </article>
          <article className="fm-kpi">
            <span>入金済合計</span>
            <strong>{yen(settledSales)}</strong>
          </article>
          <article className="fm-kpi">
            <span>原価合計</span>
            <strong>{yen(paymentTotal)}</strong>
          </article>
          <article className="fm-kpi">
            <span>粗利見込</span>
            <strong>{yen(grossEstimate)}</strong>
            <span>利益率 {grossRate.toFixed(1)}%</span>
          </article>
        </section>

        {localMode ? <p className="warning">ローカルモード: このブラウザ内に保存されます（サーバー未接続）。</p> : null}

        <section className="fm-action-banner">
          <div>
            <p className="fm-action-label">次にやること</p>
            <strong>{nextAction.title}</strong>
            <p className="fm-step-note">{nextAction.detail}</p>
            <div className="fm-step-chips">
              <span className={`fm-step-chip ${stepEstimateDone ? "is-done" : ""}`}>STEP1 見積</span>
              <span className={`fm-step-chip ${stepInvoiceDone ? "is-done" : ""}`}>STEP2 請求</span>
              <span className={`fm-step-chip ${stepInvoiceSettled ? "is-done" : ""}`}>STEP2 入金</span>
              <span className={`fm-step-chip ${stepPaymentDone ? "is-done" : ""}`}>STEP3 支払</span>
            </div>
          </div>
          <div className="fm-quick-actions">
            <a href="#step-estimate" className="fm-btn fm-btn-ghost">
              STEP1へ
            </a>
            <a href="#step-invoice" className="fm-btn fm-btn-ghost">
              STEP2へ
            </a>
            <a href="#step-payment" className="fm-btn fm-btn-ghost">
              STEP3へ
            </a>
            <a href="#step-docs" className="fm-btn fm-btn-ghost">
              STEP4へ
            </a>
          </div>
        </section>

        <div className="fm-layout">
          <section className="fm-main">
            <article id="step-estimate" className="fm-card">
              <h2>STEP 1: 見積を作る</h2>
              <p className="fm-step-note">工事項目を選んで「明細追加」を押します。</p>
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
                <button className="fm-btn" onClick={onAddProjectItem} disabled={working || masterOptions.length === 0}>
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
                      <th>見積金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectItems.length === 0 ? (
                      <tr>
                        <td colSpan={5}>明細はまだありません。</td>
                      </tr>
                    ) : null}
                    {projectItems.map((item) => (
                      <tr key={item.id}>
                        <td>{item.category}</td>
                        <td>{item.item_name}</td>
                        <td>{item.quantity}</td>
                        <td>{yen(item.unit_price)}</td>
                        <td>{yen(item.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article id="step-invoice" className="fm-card">
              <h2>STEP 2: 請求を登録 / 入金を反映</h2>
              <p className="fm-step-note">左が新規請求、右が入金反映です。</p>
              <div className="fm-split">
                <div className="fm-subcard">
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
                  <button className="fm-btn" onClick={onAddInvoice} disabled={working}>
                    請求を登録
                  </button>
                </div>
                <div className="fm-subcard">
                  <label>
                    更新対象請求ID
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
                  <button className="fm-btn" onClick={onSettleInvoice} disabled={working || !invoiceToUpdate}>
                    入金を反映
                  </button>
                  <p className="fm-row-note">
                    現在選択: {activeInvoice ? `${activeInvoice.invoice_id} / ${activeInvoice.status ?? "-"}` : "-"}
                  </p>
                </div>
              </div>
            </article>
          </section>

          <aside className="fm-side">
            <article className="fm-card">
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
                  <input value={`${((project?.target_margin_rate ?? 0) * 100).toFixed(1)}%`} disabled />
                </label>
                <label>
                  作成日
                  <input value={project?.created_at ?? ""} disabled />
                </label>
              </div>
            </article>

            <article id="step-payment" className="fm-card">
              <h2>STEP 3: 支払を登録 / 消込</h2>
              <p className="fm-step-note">左から順に、業者支払を登録して消込します。</p>
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
              <button className="fm-btn" onClick={onAddPayment} disabled={working}>
                支払を登録
              </button>
              <label>
                更新対象支払ID
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
              <button className="fm-btn" onClick={onSettlePayment} disabled={working || !paymentToUpdate}>
                支払消込を反映
              </button>
              <p className="fm-row-note">
                現在選択: {activePayment ? `${activePayment.payment_id} / ${activePayment.status ?? "-"}` : "-"}
              </p>
            </article>

            <article id="step-docs" className="fm-card">
              <h2>STEP 4: 書類発行 / 連絡</h2>
              <div className="fm-doc-actions fm-doc-actions-stack">
                <button className="fm-btn" onClick={onExportEstimate} disabled={working}>
                  見積書PDFを出力
                </button>
                <button className="fm-btn" onClick={onExportReceipt} disabled={working || !invoiceIdForPdf}>
                  領収書PDFを出力
                </button>
                <button className="fm-btn" onClick={onDraftInvoiceMail} disabled={working || invoices.length === 0}>
                  請求メール文面を作成
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
              <div className="table-wrap">
                <table className="table fm-table-dense">
                  <thead>
                    <tr>
                      <th>区分</th>
                      <th>ID</th>
                      <th>金額</th>
                      <th>残額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.invoice_id}>
                        <td>請求</td>
                        <td>{inv.invoice_id}</td>
                        <td>{yen(inv.invoice_amount)}</td>
                        <td>{yen(inv.remaining_amount)}</td>
                      </tr>
                    ))}
                    {payments.map((pay) => (
                      <tr key={pay.payment_id}>
                        <td>支払</td>
                        <td>{pay.payment_id}</td>
                        <td>{yen(pay.ordered_amount)}</td>
                        <td>{yen(pay.remaining_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </aside>
        </div>
      </section>

      {message ? <p className="message">{message}</p> : null}
    </main>
  );
}
