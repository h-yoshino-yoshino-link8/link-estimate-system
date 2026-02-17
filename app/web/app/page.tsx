"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createProject,
  createProjectItem,
  downloadBlob,
  exportEstimate,
  exportReceipt,
  getCustomers,
  getProjectItems,
  getWorkItems,
  syncExcel,
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

  const [projectIdForItem, setProjectIdForItem] = useState("P-003");
  const [masterItemId, setMasterItemId] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");

  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  const masterOptions = useMemo(
    () => workItems.map((w) => ({ id: w.id, label: `${w.category} / ${w.item_name} / ¥${w.standard_unit_price}` })),
    [workItems],
  );

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
      setMessage(`案件を作成しました: ${created.project_id} / ${created.project_sheet_name}`);
      setProjectName("");
      setSiteAddress("");
      await loadProjectItems(created.project_id);
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
      const result = await syncExcel(syncWorkbookPath.trim() || undefined);
      await loadCustomers();
      await loadWorkItems();
      setMessage(
        `同期完了: 顧客${result.customers_upserted} / 案件${result.projects_upserted} / 請求${result.invoices_upserted} / 項目${result.work_items_upserted}`,
      );
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
      setMessage("案件明細を追加しました");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "案件明細追加に失敗しました");
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

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">LinK Estimate System</p>
        <h1>操作パネル (MVP)</h1>
        <p className="sub">新規案件作成・Excel同期・明細登録・帳票PDF出力をWeb化した構成です。</p>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>Excel同期</h2>
          <label>
            Workbook Path（空欄で既定）
            <input
              value={syncWorkbookPath}
              onChange={(e) => setSyncWorkbookPath(e.target.value)}
              placeholder="/path/to/見積原価管理システム.xlsm"
            />
          </label>
          <button onClick={onSyncExcel} disabled={working}>
            Excelから同期
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
