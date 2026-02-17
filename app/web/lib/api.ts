const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");
const API_KEY = (process.env.NEXT_PUBLIC_APP_API_KEY ?? "").trim();
const FORCE_LOCAL_DATA = process.env.NEXT_PUBLIC_FORCE_LOCAL_DATA === "1";
const LOCAL_DB_KEY = "link_estimate_local_db_v1";
const LOCAL_MODE_KEY = "link_estimate_local_mode_enabled";
const LOCAL_MODE_EVENT = "link_estimate_local_mode_change";

export type WorkItemMaster = {
  id: number;
  source_item_id?: number | null;
  category: string;
  item_name: string;
  specification?: string | null;
  unit?: string | null;
  standard_unit_price: number;
};

export type Project = {
  project_id: string;
  project_sheet_name: string;
  customer_id: string;
  customer_name: string;
  project_name: string;
  site_address?: string | null;
  owner_name: string;
  target_margin_rate: number;
  project_status: string;
  created_at: string;
};

export type ProjectListResponse = {
  items: Project[];
  total: number;
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
  billed_at?: string | null;
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
  paid_at?: string | null;
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

type Customer = {
  customer_id: string;
  customer_name: string;
  contact_name?: string | null;
  status: string;
};

type LocalDb = {
  customers: Customer[];
  projects: Project[];
  work_items: WorkItemMaster[];
  project_items: ProjectItem[];
  invoices: Invoice[];
  payments: Payment[];
};

function isBrowser() {
  return typeof window !== "undefined";
}

function ymd(date = new Date()) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function deriveInvoiceStatus(invoiceAmount: number, paidAmount: number) {
  const remaining = Math.max(invoiceAmount - paidAmount, 0);
  if (invoiceAmount <= 0) return "❌未入金";
  if (remaining <= 0) return "✅入金済";
  if (paidAmount > 0) return "⚠一部入金";
  return "❌未入金";
}

function derivePaymentStatus(orderedAmount: number, paidAmount: number) {
  const remaining = Math.max(orderedAmount - paidAmount, 0);
  if (orderedAmount <= 0) return "❌未支払";
  if (remaining <= 0) return "✅支払済";
  if (paidAmount > 0) return "⚠一部支払";
  return "❌未支払";
}

function nextPrefixedId(values: string[], prefix: string) {
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  values.forEach((raw) => {
    const m = re.exec((raw || "").trim());
    if (!m) return;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  });
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sameDayLastYear(base: Date) {
  const copy = new Date(base);
  copy.setFullYear(base.getFullYear() - 1);
  return copy;
}

function seedLocalDb(): LocalDb {
  return {
    customers: [
      { customer_id: "C-001", customer_name: "吉野様", status: "アクティブ" },
      { customer_id: "C-002", customer_name: "テスト顧客", status: "アクティブ" },
    ],
    projects: [],
    work_items: [
      { id: 1, category: "木工", item_name: "キッチン施工", unit: "式", standard_unit_price: 180000 },
      { id: 2, category: "内装", item_name: "クロス貼替", unit: "m2", standard_unit_price: 1400 },
      { id: 3, category: "設備", item_name: "給排水接続", unit: "式", standard_unit_price: 80000 },
    ],
    project_items: [],
    invoices: [],
    payments: [],
  };
}

function readLocalDb(): LocalDb {
  if (!isBrowser()) return seedLocalDb();
  const raw = window.localStorage.getItem(LOCAL_DB_KEY);
  if (!raw) {
    const seeded = seedLocalDb();
    window.localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    return JSON.parse(raw) as LocalDb;
  } catch {
    const seeded = seedLocalDb();
    window.localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function writeLocalDb(db: LocalDb) {
  if (!isBrowser()) return;
  window.localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
}

function normalizeNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /DNS_HOSTNAME_RESOLVED_PRIVATE|ENOTFOUND|Failed to fetch|NetworkError|fetch failed/i.test(
      message,
    )
  ) {
    return "APIに接続できません。ネットワークまたはサーバー設定を確認してください。";
  }
  return message;
}

function clearLocalMode() {
  if (!isBrowser()) return;
  if (!window.sessionStorage.getItem(LOCAL_MODE_KEY)) return;
  window.sessionStorage.removeItem(LOCAL_MODE_KEY);
  window.dispatchEvent(new Event(LOCAL_MODE_EVENT));
}

function markLocalMode(reason: unknown) {
  if (!isBrowser()) return;
  if (!window.sessionStorage.getItem(LOCAL_MODE_KEY)) {
    window.sessionStorage.setItem(LOCAL_MODE_KEY, "1");
    console.warn("[LinK] API接続に失敗したため、ローカルデータモードへ切替", reason);
    window.dispatchEvent(new Event(LOCAL_MODE_EVENT));
  }
}

function apiFetch(input: string, init?: RequestInit) {
  const headers = new Headers(init?.headers ?? undefined);
  if (API_KEY) headers.set("X-API-Key", API_KEY);
  return fetch(input, { ...init, headers });
}

type FallbackOption = {
  allowFallbackOnError?: boolean;
};

async function withFallback<T>(
  remote: () => Promise<T>,
  fallback: () => T | Promise<T>,
  option?: FallbackOption,
) {
  if (FORCE_LOCAL_DATA) {
    markLocalMode("FORCE_LOCAL_DATA");
    return await fallback();
  }
  try {
    const result = await remote();
    clearLocalMode();
    return result;
  } catch (error) {
    const allowFallbackOnError = option?.allowFallbackOnError !== false;
    if (!isBrowser() || !allowFallbackOnError) throw new Error(normalizeNetworkError(error));
    markLocalMode(error);
    return await fallback();
  }
}

export function isLocalModeEnabled() {
  if (!isBrowser()) return FORCE_LOCAL_DATA;
  return FORCE_LOCAL_DATA || window.sessionStorage.getItem(LOCAL_MODE_KEY) === "1";
}

export function onLocalModeChanged(callback: () => void) {
  if (!isBrowser()) return () => undefined;
  window.addEventListener(LOCAL_MODE_EVENT, callback);
  return () => window.removeEventListener(LOCAL_MODE_EVENT, callback);
}

function localGetCustomers() {
  return readLocalDb().customers;
}

function localCreateProject(payload: {
  customer_id: string;
  project_name: string;
  site_address?: string;
  owner_name?: string;
  target_margin_rate?: number;
}) {
  const db = readLocalDb();
  const customer = db.customers.find((x) => x.customer_id === payload.customer_id);
  if (!customer) throw new Error("顧客が存在しません");

  const projectId = nextPrefixedId(db.projects.map((x) => x.project_id), "P");
  const project: Project = {
    project_id: projectId,
    project_sheet_name: `${projectId}_${(payload.project_name || "案件").slice(0, 20)}`,
    customer_id: customer.customer_id,
    customer_name: customer.customer_name,
    project_name: (payload.project_name || "案件").trim(),
    site_address: payload.site_address?.trim() || null,
    owner_name: payload.owner_name?.trim() || "吉野博",
    target_margin_rate: payload.target_margin_rate ?? 0.25,
    project_status: "①リード",
    created_at: ymd(),
  };

  db.projects.push(project);
  writeLocalDb(db);
  return project;
}

function localGetProjects(params?: { customer_id?: string; status?: string }): ProjectListResponse {
  const db = readLocalDb();
  let items = [...db.projects];
  if (params?.customer_id) items = items.filter((x) => x.customer_id === params.customer_id);
  if (params?.status) items = items.filter((x) => x.project_status === params.status);
  return { items, total: items.length };
}

function localGetProject(projectId: string): Project {
  const row = readLocalDb().projects.find((x) => x.project_id === projectId);
  if (!row) throw new Error("案件が存在しません");
  return row;
}

function localSyncExcel() {
  return {
    workbook_path: "local-storage-mode",
    customers_upserted: 0,
    projects_upserted: 0,
    invoices_upserted: 0,
    payments_upserted: 0,
    work_items_upserted: 0,
  };
}

function localGetWorkItems() {
  return readLocalDb().work_items;
}

function localCreateProjectItem(
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
): ProjectItem {
  const db = readLocalDb();
  if (!db.projects.find((x) => x.project_id === projectId)) throw new Error("案件が存在しません");

  const master = payload.master_item_id ? db.work_items.find((x) => x.id === payload.master_item_id) : undefined;
  const quantity = Number(payload.quantity || 1);
  const unitPrice = Number(payload.unit_price ?? master?.standard_unit_price ?? 0);

  const row: ProjectItem = {
    id: (db.project_items.reduce((m, x) => Math.max(m, x.id), 0) || 0) + 1,
    project_id: projectId,
    category: payload.category ?? master?.category ?? "その他",
    item_name: payload.item_name ?? master?.item_name ?? "項目",
    specification: payload.specification ?? master?.specification ?? null,
    unit: payload.unit ?? master?.unit ?? "式",
    quantity,
    unit_price: unitPrice,
    line_total: quantity * unitPrice,
  };
  db.project_items.push(row);
  writeLocalDb(db);
  return row;
}

function localGetProjectItems(projectId: string) {
  return readLocalDb().project_items.filter((x) => x.project_id === projectId);
}

function localGetInvoices(projectId?: string) {
  const rows = readLocalDb().invoices;
  if (!projectId) return rows;
  return rows.filter((x) => x.project_id === projectId);
}

function localCreateInvoice(payload: {
  project_id: string;
  invoice_amount: number;
  invoice_type?: string;
  billed_at?: string;
  paid_amount?: number;
  status?: string;
  note?: string;
}): Invoice {
  const db = readLocalDb();
  if (!db.projects.find((x) => x.project_id === payload.project_id)) throw new Error("案件が存在しません");
  const invoiceId = nextPrefixedId(db.invoices.map((x) => x.invoice_id), "INV");
  const amount = Number(payload.invoice_amount || 0);
  const paid = Number(payload.paid_amount || 0);
  const remaining = Math.max(amount - paid, 0);
  const row: Invoice = {
    invoice_id: invoiceId,
    project_id: payload.project_id,
    invoice_amount: amount,
    invoice_type: payload.invoice_type ?? "一括",
    billed_at: payload.billed_at ?? ymd(),
    paid_amount: paid,
    remaining_amount: remaining,
    status: payload.status ?? deriveInvoiceStatus(amount, paid),
    note: payload.note ?? null,
  };
  db.invoices.push(row);
  writeLocalDb(db);
  return row;
}

function localUpdateInvoice(
  invoiceId: string,
  payload: {
    paid_amount?: number;
    invoice_amount?: number;
    status?: string;
    note?: string;
  },
): Invoice {
  const db = readLocalDb();
  const row = db.invoices.find((x) => x.invoice_id === invoiceId);
  if (!row) throw new Error("請求が存在しません");
  if (payload.invoice_amount !== undefined) row.invoice_amount = Number(payload.invoice_amount);
  if (payload.paid_amount !== undefined) row.paid_amount = Number(payload.paid_amount);
  if (payload.note !== undefined) row.note = payload.note;
  row.remaining_amount = Math.max(Number(row.invoice_amount) - Number(row.paid_amount), 0);
  row.status = payload.status ?? deriveInvoiceStatus(row.invoice_amount, row.paid_amount);
  writeLocalDb(db);
  return row;
}

function localGetPayments(projectId?: string) {
  const rows = readLocalDb().payments;
  if (!projectId) return rows;
  return rows.filter((x) => x.project_id === projectId);
}

function localCreatePayment(payload: {
  project_id: string;
  vendor_name?: string;
  ordered_amount: number;
  paid_amount?: number;
  status?: string;
  note?: string;
}): Payment {
  const db = readLocalDb();
  if (!db.projects.find((x) => x.project_id === payload.project_id)) throw new Error("案件が存在しません");
  const paymentId = nextPrefixedId(db.payments.map((x) => x.payment_id), "PAY");
  const ordered = Number(payload.ordered_amount || 0);
  const paid = Number(payload.paid_amount || 0);
  const remaining = Math.max(ordered - paid, 0);
  const row: Payment = {
    payment_id: paymentId,
    project_id: payload.project_id,
    vendor_name: payload.vendor_name ?? "未設定",
    ordered_amount: ordered,
    paid_amount: paid,
    remaining_amount: remaining,
    status: payload.status ?? derivePaymentStatus(ordered, paid),
    note: payload.note ?? null,
    paid_at: null,
  };
  db.payments.push(row);
  writeLocalDb(db);
  return row;
}

function localUpdatePayment(
  paymentId: string,
  payload: {
    paid_amount?: number;
    ordered_amount?: number;
    status?: string;
    note?: string;
  },
): Payment {
  const db = readLocalDb();
  const row = db.payments.find((x) => x.payment_id === paymentId);
  if (!row) throw new Error("支払が存在しません");
  if (payload.ordered_amount !== undefined) row.ordered_amount = Number(payload.ordered_amount);
  if (payload.paid_amount !== undefined) row.paid_amount = Number(payload.paid_amount);
  if (payload.note !== undefined) row.note = payload.note;
  row.remaining_amount = Math.max(Number(row.ordered_amount) - Number(row.paid_amount), 0);
  row.status = payload.status ?? derivePaymentStatus(row.ordered_amount, row.paid_amount);
  writeLocalDb(db);
  return row;
}

function localDashboardSummary(): DashboardSummary {
  const db = readLocalDb();
  const project_status_counts: Record<string, number> = {};
  db.projects.forEach((p) => {
    project_status_counts[p.project_status] = (project_status_counts[p.project_status] ?? 0) + 1;
  });

  const invoice_total_amount = db.invoices.reduce((sum, x) => sum + Number(x.invoice_amount || 0), 0);
  const invoice_remaining_amount = db.invoices.reduce((sum, x) => sum + Number(x.remaining_amount || 0), 0);
  const payment_total_amount = db.payments.reduce((sum, x) => sum + Number(x.ordered_amount || 0), 0);
  const payment_remaining_amount = db.payments.reduce((sum, x) => sum + Number(x.remaining_amount || 0), 0);
  const item_total_amount = db.project_items.reduce((sum, x) => sum + Number(x.line_total || 0), 0);

  return {
    project_total: db.projects.length,
    project_status_counts,
    invoice_total_amount,
    invoice_remaining_amount,
    payment_total_amount,
    payment_remaining_amount,
    item_total_amount,
  };
}

function localDashboardOverview(): DashboardOverview {
  const db = readLocalDb();
  const today = new Date();
  const month = today.getMonth();
  const currentYear = today.getFullYear();
  const lastYearDate = sameDayLastYear(today);

  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: `${i + 1}月`, amount: 0 }));
  let current_month_sales = 0;
  let ytd_sales = 0;
  let last_year_ytd_sales = 0;

  db.invoices.forEach((inv) => {
    const billed = parseDate(inv.billed_at);
    if (!billed) return;
    const amount = Number(inv.invoice_amount || 0);
    if (billed.getFullYear() === currentYear) {
      monthly[billed.getMonth()].amount += amount;
      if (billed.getMonth() === month) current_month_sales += amount;
      if (billed <= today) ytd_sales += amount;
    } else if (billed.getFullYear() === currentYear - 1 && billed <= lastYearDate) {
      last_year_ytd_sales += amount;
    }
  });

  const all_time_sales = db.invoices.reduce((sum, x) => sum + Number(x.invoice_amount || 0), 0);
  const receivable_balance = db.invoices.reduce((sum, x) => sum + Number(x.remaining_amount || 0), 0);
  const payable_balance = db.payments.reduce((sum, x) => sum + Number(x.remaining_amount || 0), 0);

  const yoy_growth_rate =
    last_year_ytd_sales > 0 ? ((ytd_sales - last_year_ytd_sales) / last_year_ytd_sales) * 100 : 0;

  const invoiceByProject = new Map<string, number>();
  db.invoices.forEach((inv) => {
    invoiceByProject.set(inv.project_id, (invoiceByProject.get(inv.project_id) ?? 0) + Number(inv.invoice_amount || 0));
  });
  const paymentByProject = new Map<string, number>();
  db.payments.forEach((pay) => {
    paymentByProject.set(pay.project_id, (paymentByProject.get(pay.project_id) ?? 0) + Number(pay.ordered_amount || 0));
  });

  const active_projects = db.projects
    .filter((project) => !(project.project_status.includes("完工") || project.project_status.includes("失注")))
    .map((project) => {
      const invoice_total_amount = invoiceByProject.get(project.project_id) ?? 0;
      const payment_total_amount = paymentByProject.get(project.project_id) ?? 0;
      return {
        project_id: project.project_id,
        project_name: project.project_name,
        customer_name: project.customer_name,
        project_status: project.project_status,
        site_address: project.site_address,
        created_at: project.created_at,
        invoice_total_amount,
        payment_total_amount,
        gross_estimate: invoice_total_amount - payment_total_amount,
      };
    })
    .slice(0, 12);

  return {
    current_month_sales,
    ytd_sales,
    all_time_sales,
    last_year_ytd_sales,
    yoy_growth_rate,
    receivable_balance,
    payable_balance,
    active_project_count: active_projects.length,
    monthly_sales_current_year: monthly,
    active_projects,
  };
}

function localEstimateBlob(projectId: string) {
  const db = readLocalDb();
  const project = db.projects.find((p) => p.project_id === projectId);
  const items = db.project_items.filter((x) => x.project_id === projectId);
  const total = items.reduce((sum, x) => sum + Number(x.line_total || 0), 0);
  const text = [
    "見積書（ローカルモード）",
    `案件ID: ${projectId}`,
    `物件名: ${project?.project_name ?? "-"}`,
    `顧客: ${project?.customer_name ?? "-"}`,
    `見積合計: ¥${Math.round(total).toLocaleString()}`,
    "",
    "※API未接続のためブラウザ内データで生成",
  ].join("\n");
  return new Blob([text], { type: "application/pdf" });
}

function localReceiptBlob(invoiceId: string) {
  const db = readLocalDb();
  const invoice = db.invoices.find((x) => x.invoice_id === invoiceId);
  const text = [
    "領収書（ローカルモード）",
    `請求ID: ${invoiceId}`,
    `案件ID: ${invoice?.project_id ?? "-"}`,
    `入金額: ¥${Math.round(Number(invoice?.paid_amount || 0)).toLocaleString()}`,
    "",
    "※API未接続のためブラウザ内データで生成",
  ].join("\n");
  return new Blob([text], { type: "application/pdf" });
}

export async function getCustomers() {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/customers`, { cache: "no-store" });
      if (!res.ok) throw new Error("顧客一覧の取得に失敗しました");
      return await res.json();
    },
    () => localGetCustomers(),
  );
}

export async function createProject(payload: {
  customer_id: string;
  project_name: string;
  site_address?: string;
  owner_name?: string;
  target_margin_rate?: number;
}) {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`案件作成に失敗しました: ${body}`);
      }
      return await res.json();
    },
    () => localCreateProject(payload),
    { allowFallbackOnError: false },
  );
}

export async function getProjects(params?: { customer_id?: string; status?: string }) {
  return withFallback(
    async () => {
      const search = new URLSearchParams();
      if (params?.customer_id) search.set("customer_id", params.customer_id);
      if (params?.status) search.set("status", params.status);
      const qs = search.toString();
      const res = await apiFetch(`${API_BASE}/api/v1/projects${qs ? `?${qs}` : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error("案件一覧の取得に失敗しました");
      return (await res.json()) as ProjectListResponse;
    },
    () => localGetProjects(params),
  );
}

export async function getProject(projectId: string) {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/projects/${encodeURIComponent(projectId)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("案件詳細の取得に失敗しました");
      return (await res.json()) as Project;
    },
    () => localGetProject(projectId),
  );
}

export async function syncExcel(workbookPath?: string) {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/sync/excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workbook_path: workbookPath || null }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Excel同期に失敗しました: ${body}`);
      }
      return await res.json();
    },
    () => localSyncExcel(),
    { allowFallbackOnError: false },
  );
}

export async function syncExcelUpload(file: File) {
  return withFallback(
    async () => {
      const form = new FormData();
      form.append("file", file);

      const res = await apiFetch(`${API_BASE}/api/v1/sync/excel/upload`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Excelアップロード同期に失敗しました: ${body}`);
      }
      return await res.json();
    },
    () => localSyncExcel(),
    { allowFallbackOnError: false },
  );
}

export async function getWorkItems() {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/work-items`, { cache: "no-store" });
      if (!res.ok) throw new Error("工事項目の取得に失敗しました");
      return (await res.json()) as WorkItemMaster[];
    },
    () => localGetWorkItems(),
  );
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
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/projects/${projectId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`明細追加に失敗しました: ${body}`);
      }
      return (await res.json()) as ProjectItem;
    },
    () => localCreateProjectItem(projectId, payload),
    { allowFallbackOnError: false },
  );
}

export async function getProjectItems(projectId: string) {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/projects/${projectId}/items`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`明細一覧取得に失敗しました: ${body}`);
      }
      return (await res.json()) as ProjectItem[];
    },
    () => localGetProjectItems(projectId),
  );
}

export async function getInvoices(projectId?: string) {
  return withFallback(
    async () => {
      const search = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
      const res = await apiFetch(`${API_BASE}/api/v1/invoices${search}`, { cache: "no-store" });
      if (!res.ok) throw new Error("請求一覧取得に失敗しました");
      return (await res.json()) as Invoice[];
    },
    () => localGetInvoices(projectId),
  );
}

export async function createInvoice(payload: {
  project_id: string;
  invoice_amount: number;
  invoice_type?: string;
  billed_at?: string;
  paid_amount?: number;
  status?: string;
  note?: string;
}) {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`請求登録に失敗しました: ${body}`);
      }
      return (await res.json()) as Invoice;
    },
    () => localCreateInvoice(payload),
    { allowFallbackOnError: false },
  );
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
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/invoices/${encodeURIComponent(invoiceId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`請求更新に失敗しました: ${body}`);
      }
      return (await res.json()) as Invoice;
    },
    () => localUpdateInvoice(invoiceId, payload),
    { allowFallbackOnError: false },
  );
}

export async function getPayments(projectId?: string) {
  return withFallback(
    async () => {
      const search = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
      const res = await apiFetch(`${API_BASE}/api/v1/payments${search}`, { cache: "no-store" });
      if (!res.ok) throw new Error("支払一覧取得に失敗しました");
      return (await res.json()) as Payment[];
    },
    () => localGetPayments(projectId),
  );
}

export async function createPayment(payload: {
  project_id: string;
  vendor_name?: string;
  ordered_amount: number;
  paid_amount?: number;
  status?: string;
  note?: string;
}) {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`支払登録に失敗しました: ${body}`);
      }
      return (await res.json()) as Payment;
    },
    () => localCreatePayment(payload),
    { allowFallbackOnError: false },
  );
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
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/payments/${encodeURIComponent(paymentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`支払更新に失敗しました: ${body}`);
      }
      return (await res.json()) as Payment;
    },
    () => localUpdatePayment(paymentId, payload),
    { allowFallbackOnError: false },
  );
}

export async function getDashboardSummary() {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/dashboard/summary`, { cache: "no-store" });
      if (!res.ok) throw new Error("ダッシュボード集計取得に失敗しました");
      return (await res.json()) as DashboardSummary;
    },
    () => localDashboardSummary(),
  );
}

export async function getDashboardOverview() {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/dashboard/overview`, { cache: "no-store" });
      if (!res.ok) throw new Error("ダッシュボード概要取得に失敗しました");
      return (await res.json()) as DashboardOverview;
    },
    () => localDashboardOverview(),
  );
}

export async function exportEstimate(projectId: string) {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/documents/estimate-cover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });
      if (!res.ok) throw new Error("見積書PDF出力に失敗しました");
      return { blob: await res.blob(), disposition: res.headers.get("content-disposition") };
    },
    () => ({ blob: localEstimateBlob(projectId), disposition: null }),
    { allowFallbackOnError: false },
  );
}

export async function exportReceipt(invoiceId: string) {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/documents/receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      if (!res.ok) throw new Error("領収書PDF出力に失敗しました");
      return { blob: await res.blob(), disposition: res.headers.get("content-disposition") };
    },
    () => ({ blob: localReceiptBlob(invoiceId), disposition: null }),
    { allowFallbackOnError: false },
  );
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
