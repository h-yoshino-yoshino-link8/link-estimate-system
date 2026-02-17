"use client";

import { useEffect, useState } from "react";
import {
  createProject,
  downloadBlob,
  exportEstimate,
  exportReceipt,
  getCustomers,
} from "../lib/api";

type Customer = {
  customer_id: string;
  customer_name: string;
};

export default function HomePage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  const [customerId, setCustomerId] = useState("C-001");
  const [projectName, setProjectName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [ownerName, setOwnerName] = useState("吉野博");
  const [marginRate, setMarginRate] = useState("0.25");

  const [projectIdForPdf, setProjectIdForPdf] = useState("P-003");
  const [invoiceIdForPdf, setInvoiceIdForPdf] = useState("INV-001");

  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getCustomers();
        setCustomers(data);
        if (data.length > 0) {
          setCustomerId(data[0].customer_id);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "顧客取得に失敗しました");
      } finally {
        setLoadingCustomers(false);
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
      setMessage(`案件を作成しました: ${created.project_id} / ${created.project_sheet_name}`);
      setProjectName("");
      setSiteAddress("");
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

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">LinK Estimate System</p>
        <h1>操作パネル (MVP)</h1>
        <p className="sub">新規案件作成と帳票PDF出力をWeb化した最小構成です。</p>
      </section>

      <section className="grid">
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
