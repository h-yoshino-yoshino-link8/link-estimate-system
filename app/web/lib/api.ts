const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export async function getCustomers() {
  const res = await fetch(`${API_BASE}/api/v1/customers`, { cache: "no-store" });
  if (!res.ok) throw new Error("顧客一覧の取得に失敗しました");
  return res.json();
}

export async function createProject(payload: {
  customer_id: string;
  project_name: string;
  site_address?: string;
  owner_name?: string;
  target_margin_rate?: number;
}) {
  const res = await fetch(`${API_BASE}/api/v1/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`案件作成に失敗しました: ${body}`);
  }
  return res.json();
}

export async function exportEstimate(projectId: string) {
  const res = await fetch(`${API_BASE}/api/v1/documents/estimate-cover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId }),
  });
  if (!res.ok) throw new Error("見積書PDF出力に失敗しました");
  return { blob: await res.blob(), disposition: res.headers.get("content-disposition") };
}

export async function exportReceipt(invoiceId: string) {
  const res = await fetch(`${API_BASE}/api/v1/documents/receipt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoice_id: invoiceId }),
  });
  if (!res.ok) throw new Error("領収書PDF出力に失敗しました");
  return { blob: await res.blob(), disposition: res.headers.get("content-disposition") };
}

export function downloadBlob(blob: Blob, fallbackName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
