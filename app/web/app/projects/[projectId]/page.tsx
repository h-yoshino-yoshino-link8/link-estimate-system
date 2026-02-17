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
  getInvoices,
  getPayments,
  getProjectItems,
  getProjects,
  getWorkItems,
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

  const loadWorkspace = async () => {
    const [projectsResp, workItemsResp, itemsResp, invoicesResp, paymentsResp] = await Promise.all([
      getProjects(),
      getWorkItems(),
      getProjectItems(projectId),
      getInvoices(projectId),
      getPayments(projectId),
    ]);

    setProject(projectsResp.items.find((x) => x.project_id === projectId) ?? null);
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
      <section className="hero">
        <p className="eyebrow">Project Workspace</p>
        <h1>
          {projectId} / {project?.project_name ?? "案件未取得"}
        </h1>
        <p className="sub">
          顧客: {project?.customer_name ?? "-"} | 担当: {project?.owner_name ?? "-"} | ステータス: {project?.project_status ?? "-"}
        </p>
        <div className="hero-actions">
          <Link href="/projects" className="link-btn ghost">
            案件一覧へ戻る
          </Link>
          <button onClick={onReload} disabled={working}>
            最新に更新
          </button>
        </div>
      </section>

      <section className="overview-grid compact">
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
          <p className="mini-label">粗利見込</p>
          <p className="mini-value">{yen(invoiceTotal - paymentTotal)}</p>
        </article>
      </section>

      <section className="workspace-grid">
        <article className="panel">
          <h2>見積明細登録</h2>
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
          <button onClick={onAddProjectItem} disabled={working || masterOptions.length === 0}>
            明細を追加
          </button>
          <div className="items-box">
            {projectItems.length === 0 ? <p className="item-row">明細はまだありません</p> : null}
            {projectItems.slice(0, 8).map((item) => (
              <p key={item.id} className="item-row">
                {item.category} / {item.item_name} / {item.quantity} / {yen(item.line_total)}
              </p>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>請求登録・消込</h2>
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
          <button onClick={onSettleInvoice} disabled={working || !invoiceToUpdate}>
            請求を更新
          </button>
        </article>

        <article className="panel">
          <h2>支払登録・消込</h2>
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
          <button onClick={onSettlePayment} disabled={working || !paymentToUpdate}>
            支払を更新
          </button>
        </article>

        <article className="panel panel-span-2">
          <h2>帳票・メール</h2>
          <div className="action-row">
            <button onClick={onExportEstimate} disabled={working}>
              見積書PDFを出力
            </button>
            <button onClick={onDraftInvoiceMail} disabled={working || invoices.length === 0}>
              請求メール文面を作成
            </button>
          </div>
          <label>
            領収書対象の請求ID
            <select value={invoiceIdForPdf} onChange={(e) => setInvoiceIdForPdf(e.target.value)} disabled={working}>
              {invoices.length === 0 ? <option value="">請求データなし</option> : null}
              {invoices.map((inv) => (
                <option key={inv.invoice_id} value={inv.invoice_id}>
                  {inv.invoice_id} / 入金 {yen(inv.paid_amount)}
                </option>
              ))}
            </select>
          </label>
          <button onClick={onExportReceipt} disabled={working || !invoiceIdForPdf}>
            領収書PDFを出力
          </button>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>区分</th>
                  <th>ID</th>
                  <th>金額</th>
                  <th>残額</th>
                  <th>ステータス</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.invoice_id}>
                    <td>請求</td>
                    <td>{inv.invoice_id}</td>
                    <td>{yen(inv.invoice_amount)}</td>
                    <td>{yen(inv.remaining_amount)}</td>
                    <td>{inv.status ?? "-"}</td>
                  </tr>
                ))}
                {payments.map((pay) => (
                  <tr key={pay.payment_id}>
                    <td>支払</td>
                    <td>{pay.payment_id}</td>
                    <td>{yen(pay.ordered_amount)}</td>
                    <td>{yen(pay.remaining_amount)}</td>
                    <td>{pay.status ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      {message ? <p className="message">{message}</p> : null}
    </main>
  );
}
