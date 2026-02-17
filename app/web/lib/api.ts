const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");

export type WorkItemMaster = {
  id: number;
  source_item_id?: number | null;
  category: string;
  item_name: string;
  specification?: string | null;
  unit?: string | null;
  standard_unit_price: number;
};

export type ProjectItem = {
  id: number;
  project_id: string;
  category: string;
  item_name: string;
  specification?: string | null;
  unit?: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type Invoice = {
  invoice_id: string;
  project_id: string;
  invoice_amount: number;
  invoice_type?: string | null;
  paid_amount: number;
  remaining_amount: number;
  status?: string | null;
  note?: string | null;
};

export type Payment = {
  payment_id: string;
  project_id: string;
  vendor_id?: string | null;
  vendor_name?: string | null;
  work_description?: string | null;
  ordered_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status?: string | null;
  note?: string | null;
};

export type DashboardSummary = {
  project_total: number;
  project_status_counts: Record<string, number>;
  invoice_total_amount: number;
  invoice_remaining_amount: number;
  payment_total_amount: number;
  payment_remaining_amount: number;
  item_total_amount: number;
};

export type DashboardMonthlySalesPoint = {
  month: string;
  amount: number;
};

export type DashboardActiveProject = {
  project_id: string;
  project_name: string;
  customer_name: string;
  project_status: string;
  site_address?: string | null;
  created_at: string;
  invoice_total_amount: number;
  payment_total_amount: number;
  gross_estimate: number;
};

export type DashboardOverview = {
  current_month_sales: number;
  ytd_sales: number;
  all_time_sales: number;
  last_year_ytd_sales: number;
  yoy_growth_rate: number;
  receivable_balance: number;
  payable_balance: number;
  active_project_count: number;
  monthly_sales_current_year: DashboardMonthlySalesPoint[];
  active_projects: DashboardActiveProject[];
};

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

export async function syncExcel(workbookPath?: string) {
  const res = await fetch(`${API_BASE}/api/v1/sync/excel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workbook_path: workbookPath || null }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Excel同期に失敗しました: ${body}`);
  }
  return res.json();
}

export async function syncExcelUpload(file: File) {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}/api/v1/sync/excel/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Excelアップロード同期に失敗しました: ${body}`);
  }
  return res.json();
}

export async function getWorkItems() {
  const res = await fetch(`${API_BASE}/api/v1/work-items`, { cache: "no-store" });
  if (!res.ok) throw new Error("工事項目の取得に失敗しました");
  return (await res.json()) as WorkItemMaster[];
}

export async function createProjectItem(
  projectId: string,
  payload: {
    master_item_id?: number;
    category?: string;
    item_name?: string;
    specification?: string;
    unit?: string;
    quantity: number;
    unit_price?: number;
  },
) {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`明細追加に失敗しました: ${body}`);
  }
  return (await res.json()) as ProjectItem;
}

export async function getProjectItems(projectId: string) {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/items`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`明細一覧取得に失敗しました: ${body}`);
  }
  return (await res.json()) as ProjectItem[];
}

export async function getInvoices(projectId?: string) {
  const search = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  const res = await fetch(`${API_BASE}/api/v1/invoices${search}`, { cache: "no-store" });
  if (!res.ok) throw new Error("請求一覧取得に失敗しました");
  return (await res.json()) as Invoice[];
}

export async function createInvoice(payload: {
  project_id: string;
  invoice_amount: number;
  invoice_type?: string;
  paid_amount?: number;
  status?: string;
  note?: string;
}) {
  const res = await fetch(`${API_BASE}/api/v1/invoices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`請求登録に失敗しました: ${body}`);
  }
  return (await res.json()) as Invoice;
}

export async function updateInvoice(
  invoiceId: string,
  payload: {
    paid_amount?: number;
    invoice_amount?: number;
    status?: string;
    note?: string;
  },
) {
  const res = await fetch(`${API_BASE}/api/v1/invoices/${encodeURIComponent(invoiceId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`請求更新に失敗しました: ${body}`);
  }
  return (await res.json()) as Invoice;
}

export async function getPayments(projectId?: string) {
  const search = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  const res = await fetch(`${API_BASE}/api/v1/payments${search}`, { cache: "no-store" });
  if (!res.ok) throw new Error("支払一覧取得に失敗しました");
  return (await res.json()) as Payment[];
}

export async function createPayment(payload: {
  project_id: string;
  vendor_name?: string;
  ordered_amount: number;
  paid_amount?: number;
  status?: string;
  note?: string;
}) {
  const res = await fetch(`${API_BASE}/api/v1/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`支払登録に失敗しました: ${body}`);
  }
  return (await res.json()) as Payment;
}

export async function updatePayment(
  paymentId: string,
  payload: {
    paid_amount?: number;
    ordered_amount?: number;
    status?: string;
    note?: string;
  },
) {
  const res = await fetch(`${API_BASE}/api/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`支払更新に失敗しました: ${body}`);
  }
  return (await res.json()) as Payment;
}

export async function getDashboardSummary() {
  const res = await fetch(`${API_BASE}/api/v1/dashboard/summary`, { cache: "no-store" });
  if (!res.ok) throw new Error("ダッシュボード集計取得に失敗しました");
  return (await res.json()) as DashboardSummary;
}

export async function getDashboardOverview() {
  const res = await fetch(`${API_BASE}/api/v1/dashboard/overview`, { cache: "no-store" });
  if (!res.ok) throw new Error("ダッシュボード概要取得に失敗しました");
  return (await res.json()) as DashboardOverview;
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
