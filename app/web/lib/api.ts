// ============================================================
// Estimate OS — Data Layer (Supabase Only)
// ============================================================

import {
  sbGetCustomers, sbGetVendors, sbGetWorkItems,
  sbGetProjects, sbGetProject, sbCreateProject, sbCreateProjectQuick, sbUpdateProjectStatus,
  sbGetProjectItems, sbCreateProjectItem, sbUpdateProjectItem, sbDeleteProjectItem, sbReorderProjectItems,
  sbGetInvoices, sbCreateInvoice, sbUpdateInvoice,
  sbGetPayments, sbCreatePayment, sbUpdatePayment,
  sbGetDashboardOverview, sbGetOrgInfo,
  sbGetOrgSettings, sbUpdateOrgSettings,
} from "./api/supabase-ops";
export type { OrgInfo, OrgSettings } from "./api/supabase-ops";

// ============================================================
// Types (re-exported for backward compatibility)
// ============================================================

export type Customer = {
  customer_id: string;
  customer_name: string;
  contact_name?: string | null;
  phone?: string | null;
  monthly_volume?: string | null;
  status: string;
};

export type Vendor = {
  vendor_id: string;
  vendor_name: string;
  vendor_type: "subcontractor" | "supplier";
  specialty?: string | null;
  annual_order_amount: number;
  markup_rate?: number | null;
  phone?: string | null;
  note?: string | null;
};

export type WorkItemMaster = {
  id: number;
  category: string;
  item_name: string;
  specification?: string | null;
  unit: string;
  cost_price: number;
  selling_price: number;
  vendor_id?: string | null;
};

export type Project = {
  project_id: string;
  customer_id: string;
  customer_name: string;
  project_name: string;
  site_address?: string | null;
  owner_name: string;
  project_status: string;
  created_at: string;
  estimated_start?: string | null;
  estimated_end?: string | null;
  note?: string | null;
};

export type ProjectItem = {
  id: number;
  project_id: string;
  category: string;
  item_name: string;
  specification?: string | null;
  unit: string;
  quantity: number;
  cost_price: number;
  selling_price: number;
  vendor_id?: string | null;
  sort_order: number;
};

export type Invoice = {
  invoice_id: string;
  project_id: string;
  invoice_amount: number;
  billed_at: string;
  due_date: string;
  paid_amount: number;
  remaining_amount: number;
  status: string;
  note?: string | null;
};

export type Payment = {
  payment_id: string;
  project_id: string;
  vendor_id?: string | null;
  vendor_name: string;
  work_description?: string | null;
  ordered_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
  paid_at?: string | null;
  note?: string | null;
};

export type ProjectListResponse = {
  items: Project[];
  total: number;
};

export type DashboardMonthlySalesPoint = {
  month: string;
  amount: number;
  cost: number;
  margin: number;
};

export type DashboardActiveProject = {
  project_id: string;
  project_name: string;
  customer_name: string;
  project_status: string;
  selling_total: number;
  cost_total: number;
  margin: number;
  margin_rate: number;
  created_at: string;
};

export type DashboardOverview = {
  current_month_sales: number;
  next_month_projection: number;
  pipeline_total: number;
  pipeline_count: number;
  ytd_sales: number;
  last_year_ytd_sales: number;
  yoy_growth_rate: number;
  receivable_balance: number;
  payable_balance: number;
  cash_position: number;
  avg_margin_rate: number;
  all_time_sales: number;
  all_time_cost: number;
  all_time_margin: number;
  active_project_count: number;
  status_counts: Record<string, number>;
  monthly_sales: DashboardMonthlySalesPoint[];
  active_projects: DashboardActiveProject[];
  top_vendors: { vendor_name: string; amount: number; count: number }[];
};

export type EstimateTemplateItem = {
  category: string;
  item_name: string;
  unit: string;
  quantity: number;
  cost_price: number;
  selling_price: number;
};

export type EstimateTemplate = {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  items: EstimateTemplateItem[];
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

// ============================================================
// Utilities
// ============================================================

function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const PROJECT_STATUSES = ["見積中", "受注", "施工中", "完了", "請求済", "入金済", "失注"] as const;
export type ProjectStatus = typeof PROJECT_STATUSES[number];
export { PROJECT_STATUSES };

// ============================================================
// Computed helpers
// ============================================================

export function itemCostTotal(item: ProjectItem) {
  return safeNum(item.cost_price) * safeNum(item.quantity);
}

export function itemSellingTotal(item: ProjectItem) {
  return safeNum(item.selling_price) * safeNum(item.quantity);
}

export function itemMargin(item: ProjectItem) {
  return itemSellingTotal(item) - itemCostTotal(item);
}

export function marginRate(selling: number, cost: number) {
  const s = safeNum(selling);
  if (s === 0) return 0;
  return ((s - safeNum(cost)) / s) * 100;
}

// ============================================================
// Public API — Supabase direct
// ============================================================

export async function getCustomers() { return sbGetCustomers(); }
export async function getVendors() { return sbGetVendors(); }
export async function getWorkItems() { return sbGetWorkItems(); }

export async function getProjects(params?: { customer_id?: string; status?: string }) {
  return sbGetProjects(params);
}

export async function getProject(projectId: string) {
  return sbGetProject(projectId);
}

export async function createProject(payload: {
  customer_id: string;
  project_name: string;
  site_address?: string;
  owner_name?: string;
}) {
  return sbCreateProject(payload);
}

export async function createProjectQuick(payload: {
  customer_name: string;
  project_name: string;
  site_address?: string;
}) {
  return sbCreateProjectQuick(payload);
}

export async function updateProjectStatus(projectId: string, status: string) {
  return sbUpdateProjectStatus(projectId, status);
}

export async function getProjectItems(projectId: string) {
  return sbGetProjectItems(projectId);
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
    cost_price?: number;
    selling_price?: number;
  },
) {
  return sbCreateProjectItem(projectId, payload);
}

export async function updateProjectItem(
  projectId: string,
  itemId: number,
  payload: { quantity?: number; cost_price?: number; selling_price?: number },
) {
  return sbUpdateProjectItem(projectId, itemId, payload);
}

export async function deleteProjectItem(projectId: string, itemId: number) {
  return sbDeleteProjectItem(projectId, itemId);
}

export async function reorderProjectItems(projectId: string, itemIds: number[]) {
  return sbReorderProjectItems(projectId, itemIds);
}

export async function getInvoices(projectId?: string) {
  return sbGetInvoices(projectId);
}

export async function createInvoice(payload: {
  project_id: string;
  invoice_amount: number;
  note?: string;
}) {
  return sbCreateInvoice(payload);
}

export async function updateInvoice(invoiceId: string, payload: { paid_amount?: number; invoice_amount?: number; note?: string }) {
  return sbUpdateInvoice(invoiceId, payload);
}

export async function getPayments(projectId?: string) {
  return sbGetPayments(projectId);
}

export async function createPayment(payload: {
  project_id: string;
  vendor_name: string;
  work_description?: string;
  ordered_amount: number;
}) {
  return sbCreatePayment(payload);
}

export async function updatePayment(paymentId: string, payload: { paid_amount?: number; ordered_amount?: number; note?: string }) {
  return sbUpdatePayment(paymentId, payload);
}

export async function getDashboardOverview() {
  return sbGetDashboardOverview();
}

export { sbGetOrgInfo as getOrgInfo };
export { sbGetOrgSettings as getOrgSettings };
export { sbUpdateOrgSettings as updateOrgSettings };

// ============================================================
// Blob helper
// ============================================================

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

// ============================================================
// Estimate Templates
// ============================================================

const ESTIMATE_TEMPLATES: EstimateTemplate[] = [
  {
    id: "tpl-1k-genjo",
    name: "1K 原状回復",
    description: "ワンルーム・1Kの基本原状回復パック（5項目）",
    keywords: ["1K", "1R", "ワンルーム", "原状回復", "原状"],
    items: [
      { category: "内装", item_name: "クロス貼替（量産）", unit: "m2", quantity: 40, cost_price: 850, selling_price: 1400 },
      { category: "内装", item_name: "CF貼替", unit: "m2", quantity: 10, cost_price: 2800, selling_price: 4500 },
      { category: "クリーニング", item_name: "ハウスクリーニング（1K）", unit: "式", quantity: 1, cost_price: 22000, selling_price: 35000 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 15000 },
      { category: "諸経費", item_name: "廃棄物処理", unit: "式", quantity: 1, cost_price: 15000, selling_price: 25000 },
    ],
  },
  {
    id: "tpl-2dk-genjo",
    name: "2DK 原状回復",
    description: "2DKの標準原状回復パック・畳襖含む（7項目）",
    keywords: ["2DK", "2K", "原状回復", "原状"],
    items: [
      { category: "内装", item_name: "クロス貼替（量産）", unit: "m2", quantity: 70, cost_price: 850, selling_price: 1400 },
      { category: "内装", item_name: "CF貼替", unit: "m2", quantity: 15, cost_price: 2800, selling_price: 4500 },
      { category: "畳・襖", item_name: "畳表替え", unit: "枚", quantity: 6, cost_price: 3900, selling_price: 6500 },
      { category: "畳・襖", item_name: "襖張替え（両面）", unit: "枚", quantity: 4, cost_price: 4000, selling_price: 7000 },
      { category: "クリーニング", item_name: "ハウスクリーニング（2DK）", unit: "式", quantity: 1, cost_price: 35000, selling_price: 55000 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 20000 },
      { category: "諸経費", item_name: "廃棄物処理", unit: "式", quantity: 1, cost_price: 15000, selling_price: 25000 },
    ],
  },
  {
    id: "tpl-3dk-genjo",
    name: "3DK 原状回復",
    description: "3DKの標準原状回復パック・和室あり（8項目）",
    keywords: ["3DK", "3K", "原状回復", "原状"],
    items: [
      { category: "内装", item_name: "クロス貼替（量産）", unit: "m2", quantity: 90, cost_price: 850, selling_price: 1400 },
      { category: "内装", item_name: "CF貼替", unit: "m2", quantity: 20, cost_price: 2800, selling_price: 4500 },
      { category: "畳・襖", item_name: "畳表替え", unit: "枚", quantity: 12, cost_price: 3900, selling_price: 6500 },
      { category: "畳・襖", item_name: "襖張替え（両面）", unit: "枚", quantity: 6, cost_price: 4000, selling_price: 7000 },
      { category: "畳・襖", item_name: "障子張替え", unit: "枚", quantity: 4, cost_price: 2500, selling_price: 4500 },
      { category: "クリーニング", item_name: "ハウスクリーニング（2DK）", unit: "式", quantity: 1, cost_price: 35000, selling_price: 55000 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 25000 },
      { category: "諸経費", item_name: "廃棄物処理", unit: "式", quantity: 1, cost_price: 15000, selling_price: 25000 },
    ],
  },
  {
    id: "tpl-unit-bath",
    name: "ユニットバス工事",
    description: "UB周り設備交換一式（5項目）",
    keywords: ["ユニットバス", "UB", "浴室", "風呂", "バス", "水回り"],
    items: [
      { category: "設備", item_name: "トイレ交換", unit: "台", quantity: 1, cost_price: 45000, selling_price: 85000 },
      { category: "設備", item_name: "洗面台交換", unit: "台", quantity: 1, cost_price: 35000, selling_price: 65000 },
      { category: "設備", item_name: "混合水栓交換", unit: "箇所", quantity: 2, cost_price: 15000, selling_price: 28000 },
      { category: "設備", item_name: "給湯器交換", unit: "台", quantity: 1, cost_price: 85000, selling_price: 150000 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 20000 },
    ],
  },
  {
    id: "tpl-gaiheki",
    name: "外壁塗装パック",
    description: "戸建外壁塗装の基本セット（4項目）",
    keywords: ["外壁", "塗装", "ペンキ", "外装"],
    items: [
      { category: "塗装", item_name: "外壁塗装", unit: "m2", quantity: 120, cost_price: 2500, selling_price: 4200 },
      { category: "塗装", item_name: "木部塗装", unit: "m2", quantity: 25, cost_price: 1800, selling_price: 3000 },
      { category: "諸経費", item_name: "養生費", unit: "式", quantity: 1, cost_price: 5000, selling_price: 10000 },
      { category: "諸経費", item_name: "廃棄物処理", unit: "式", quantity: 1, cost_price: 15000, selling_price: 25000 },
    ],
  },
  {
    id: "tpl-3ldk-full",
    name: "3LDK戸建フルリノベーション",
    description: "3LDK戸建の全面リノベ概算（13項目）",
    keywords: ["3LDK", "フルリノベ", "リノベーション", "全面改修", "戸建", "フル"],
    items: [
      { category: "内装", item_name: "クロス貼替（1000番台）", unit: "m2", quantity: 150, cost_price: 1100, selling_price: 1800 },
      { category: "大工", item_name: "床張替え（フローリング）", unit: "m2", quantity: 80, cost_price: 6000, selling_price: 9500 },
      { category: "設備", item_name: "トイレ交換", unit: "台", quantity: 1, cost_price: 45000, selling_price: 85000 },
      { category: "設備", item_name: "洗面台交換", unit: "台", quantity: 1, cost_price: 35000, selling_price: 65000 },
      { category: "設備", item_name: "混合水栓交換", unit: "箇所", quantity: 3, cost_price: 15000, selling_price: 28000 },
      { category: "設備", item_name: "給湯器交換", unit: "台", quantity: 1, cost_price: 85000, selling_price: 150000 },
      { category: "電気", item_name: "照明器具交換", unit: "箇所", quantity: 10, cost_price: 5000, selling_price: 9000 },
      { category: "電気", item_name: "コンセント増設", unit: "箇所", quantity: 4, cost_price: 8000, selling_price: 15000 },
      { category: "塗装", item_name: "外壁塗装", unit: "m2", quantity: 100, cost_price: 2500, selling_price: 4200 },
      { category: "クリーニング", item_name: "ハウスクリーニング（2DK）", unit: "式", quantity: 1, cost_price: 35000, selling_price: 55000 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 35000 },
      { category: "諸経費", item_name: "廃棄物処理", unit: "式", quantity: 1, cost_price: 15000, selling_price: 25000 },
      { category: "諸経費", item_name: "養生費", unit: "式", quantity: 1, cost_price: 5000, selling_price: 10000 },
    ],
  },
  {
    id: "tpl-1r-genjo",
    name: "1R 原状回復",
    description: "ワンルームの最小原状回復パック（3項目）",
    keywords: ["1R", "ワンルーム", "原状"],
    items: [
      { category: "内装", item_name: "クロス貼替（量産）", unit: "m2", quantity: 30, cost_price: 850, selling_price: 1400 },
      { category: "クリーニング", item_name: "ハウスクリーニング（1K）", unit: "式", quantity: 1, cost_price: 22000, selling_price: 35000 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 10000 },
    ],
  },
  {
    id: "tpl-1ldk-genjo",
    name: "1LDK 原状回復",
    description: "1LDKの標準原状回復パック（6項目）",
    keywords: ["1LDK", "原状"],
    items: [
      { category: "内装", item_name: "クロス貼替（量産）", unit: "m2", quantity: 55, cost_price: 850, selling_price: 1400 },
      { category: "内装", item_name: "CF貼替", unit: "m2", quantity: 12, cost_price: 2800, selling_price: 4500 },
      { category: "クリーニング", item_name: "ハウスクリーニング（1K）", unit: "式", quantity: 1, cost_price: 22000, selling_price: 35000 },
      { category: "設備", item_name: "混合水栓交換", unit: "箇所", quantity: 1, cost_price: 15000, selling_price: 28000 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 15000 },
      { category: "諸経費", item_name: "廃棄物処理", unit: "式", quantity: 1, cost_price: 15000, selling_price: 25000 },
    ],
  },
  {
    id: "tpl-2ldk-genjo",
    name: "2LDK 原状回復",
    description: "2LDKの標準原状回復パック（7項目）",
    keywords: ["2LDK", "原状"],
    items: [
      { category: "内装", item_name: "クロス貼替（量産）", unit: "m2", quantity: 80, cost_price: 850, selling_price: 1400 },
      { category: "内装", item_name: "CF貼替", unit: "m2", quantity: 18, cost_price: 2800, selling_price: 4500 },
      { category: "内装", item_name: "巾木交換", unit: "m", quantity: 30, cost_price: 600, selling_price: 1000 },
      { category: "クリーニング", item_name: "ハウスクリーニング（2DK）", unit: "式", quantity: 1, cost_price: 35000, selling_price: 55000 },
      { category: "設備", item_name: "混合水栓交換", unit: "箇所", quantity: 2, cost_price: 15000, selling_price: 28000 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 20000 },
      { category: "諸経費", item_name: "廃棄物処理", unit: "式", quantity: 1, cost_price: 15000, selling_price: 25000 },
    ],
  },
  {
    id: "tpl-kitchen-pack",
    name: "キッチン交換パック",
    description: "ミニキッチン交換と周辺工事一式（4項目）",
    keywords: ["キッチン", "台所"],
    items: [
      { category: "設備", item_name: "キッチン交換（ミニ）", unit: "台", quantity: 1, cost_price: 80000, selling_price: 140000 },
      { category: "内装", item_name: "クロス貼替（量産）", unit: "m2", quantity: 10, cost_price: 850, selling_price: 1400 },
      { category: "内装", item_name: "CF貼替", unit: "m2", quantity: 6, cost_price: 2800, selling_price: 4500 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 15000 },
    ],
  },
  {
    id: "tpl-mizumawari-4ten",
    name: "水回り4点セット",
    description: "キッチン・トイレ・洗面・浴室水栓まるごとパック（6項目）",
    keywords: ["水回り", "4点", "まるごと"],
    items: [
      { category: "設備", item_name: "キッチン交換（ミニ）", unit: "台", quantity: 1, cost_price: 80000, selling_price: 140000 },
      { category: "設備", item_name: "トイレ交換", unit: "台", quantity: 1, cost_price: 45000, selling_price: 85000 },
      { category: "設備", item_name: "洗面台交換", unit: "台", quantity: 1, cost_price: 35000, selling_price: 65000 },
      { category: "設備", item_name: "混合水栓交換", unit: "箇所", quantity: 3, cost_price: 15000, selling_price: 28000 },
      { category: "設備", item_name: "排水管洗浄", unit: "式", quantity: 1, cost_price: 8000, selling_price: 15000 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 25000 },
    ],
  },
  {
    id: "tpl-taikyo-cleaning",
    name: "退去時クリーニング基本パック",
    description: "退去後の基本クリーニングセット（3項目）",
    keywords: ["退去", "クリーニング", "引渡"],
    items: [
      { category: "クリーニング", item_name: "ハウスクリーニング（1K）", unit: "式", quantity: 1, cost_price: 22000, selling_price: 35000 },
      { category: "クリーニング", item_name: "エアコンクリーニング", unit: "台", quantity: 1, cost_price: 8000, selling_price: 15000 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 10000 },
    ],
  },
];

export function getEstimateTemplates(): EstimateTemplate[] {
  return ESTIMATE_TEMPLATES;
}

export async function addTemplateToProject(projectId: string, templateId: string): Promise<ProjectItem[]> {
  const template = ESTIMATE_TEMPLATES.find((t) => t.id === templateId);
  if (!template) throw new Error("テンプレートが見つかりません");
  const added: ProjectItem[] = [];
  for (const item of template.items) {
    const created = await createProjectItem(projectId, {
      category: item.category,
      item_name: item.item_name,
      unit: item.unit,
      quantity: item.quantity,
      cost_price: item.cost_price,
      selling_price: item.selling_price,
    });
    added.push(created);
  }
  return added;
}

// ============================================================
// HTML見積書（3ページ構成: 表紙 / 大項目サマリー / 明細）
// ============================================================

export async function exportEstimateHtml(projectId: string, options?: { staffName?: string }): Promise<string> {
  const project = await getProject(projectId);
  const items = await getProjectItems(projectId);

  // 会社情報（DBから取得）
  let companyName = "Estimate OS";
  let companyAddress = "";
  let companyPhone = "";
  let companyInvoiceNumber = "";
  let companyLogoText = "&infin; Estimate OS";

  const orgInfo = await sbGetOrgInfo();
  if (orgInfo.name) {
    companyName = orgInfo.name;
    companyLogoText = `&infin; ${orgInfo.name}`;
  }
  if (orgInfo.address) companyAddress = orgInfo.address;
  if (orgInfo.phone) companyPhone = orgInfo.phone;
  if (orgInfo.invoice_number) companyInvoiceNumber = orgInfo.invoice_number;

  const groups = new Map<string, ProjectItem[]>();
  for (const item of items) {
    const cat = item.category || "その他";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(item);
  }

  const total = items.reduce((s, x) => s + safeNum(x.selling_price) * safeNum(x.quantity), 0);
  const yenFmt = (v: number) => `&yen;${Math.round(v).toLocaleString()}`;

  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

  // --- ページ2: 大項目サマリー行 ---
  let summaryRows = "";
  let summaryNo = 1;
  for (const [cat, catItems] of groups.entries()) {
    const catTotal = catItems.reduce((s, x) => s + safeNum(x.selling_price) * safeNum(x.quantity), 0);
    summaryRows += `<tr>
      <td style="text-align:center;padding:10px 6px">${summaryNo++}</td>
      <td style="padding:10px 6px;font-weight:500">${cat}</td>
      <td style="text-align:right;padding:10px 6px;font-weight:600">${yenFmt(catTotal)}</td>
    </tr>`;
  }

  // --- ページ3: 明細行 ---
  let detailRows = "";
  let rowNum = 1;
  for (const [cat, catItems] of groups.entries()) {
    const catTotal = catItems.reduce((s, x) => s + safeNum(x.selling_price) * safeNum(x.quantity), 0);
    detailRows += `<tr class="cat-header">
      <td colspan="7" style="background:#e8edf5;font-weight:700;color:#1e3a5f;padding:6px 8px;font-size:12px;border-bottom:2px solid #1e3a5f">${cat}</td>
    </tr>`;
    for (const item of catItems) {
      const lineTotal = safeNum(item.selling_price) * safeNum(item.quantity);
      detailRows += `<tr>
        <td style="text-align:center">${rowNum++}</td>
        <td>${item.item_name}</td>
        <td style="font-size:10px;color:#666">${item.specification || ""}</td>
        <td style="text-align:right">${item.quantity}</td>
        <td style="text-align:center">${item.unit}</td>
        <td style="text-align:right">${yenFmt(item.selling_price)}</td>
        <td style="text-align:right;font-weight:600">${yenFmt(lineTotal)}</td>
      </tr>`;
    }
    detailRows += `<tr class="cat-subtotal">
      <td colspan="6" style="text-align:right;padding-right:12px;font-weight:600;background:#f8fafc;border-top:1px solid #94a3b8">${cat} 小計</td>
      <td style="text-align:right;font-weight:700;background:#f8fafc;border-top:1px solid #cbd5e1">${yenFmt(catTotal)}</td>
    </tr>`;
  }

  const tax = Math.round(total * 0.1);
  const totalWithTax = total + tax;
  const amountStr = `&yen;${Math.round(totalWithTax).toLocaleString()}-`;

  return `<!DOCTYPE html><html lang="ja">
<head><meta charset="utf-8">
<title>御見積書 - ${project?.project_name ?? projectId}</title>
<style>
  @page { size: A4 landscape; margin: 15mm 20mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:"Hiragino Kaku Gothic Pro","Yu Gothic","Meiryo",sans-serif; font-size:11px; color:#333; line-height:1.5; }
  .page { page-break-after: always; width:257mm; overflow:hidden; }
  .page:last-child { page-break-after: auto; }

  /* === 表紙 === */
  .cover { padding:0; }
  .cover-top { text-align:right; margin-bottom:6mm; }
  .cover-date { font-size:11px; color:#555; }

  .cover-title-wrap { text-align:center; margin:6mm 0 8mm; }
  .cover-title { font-size:28px; font-weight:700; letter-spacing:16px; color:#1e3a5f; display:inline-block; border-bottom:3px double #1e3a5f; padding:0 20px 8px; }

  .cover-body { display:flex; justify-content:space-between; gap:20mm; }

  .cover-to { margin-bottom:6mm; }
  .cover-customer-name { font-size:20px; font-weight:700; display:inline-block; border-bottom:1px solid #333; padding:0 24px 4px; }
  .cover-customer-suffix { font-size:13px; font-weight:400; color:#555; margin-left:8px; }

  .cover-left { flex:1; }

  .cover-amount-wrap { margin-bottom:7mm; text-align:center; }
  .cover-amount-label { font-size:12px; color:#555; margin-bottom:4px; }
  .cover-amount-box { border-top:3px double #1e3a5f; border-bottom:3px double #1e3a5f; padding:10px 0; max-width:400px; margin:0 auto; }
  .cover-amount { font-size:26px; font-weight:800; color:#1e3a5f; letter-spacing:2px; }
  .cover-amount-note { font-size:10px; color:#888; margin-top:2px; }

  .cover-detail-table { width:100%; border-collapse:collapse; font-size:11px; }
  .cover-detail-table th { background:none; color:#555; font-weight:600; text-align:left; padding:5px 8px; border:none; border-bottom:1px solid #ddd; width:100px; font-size:11px; }
  .cover-detail-table td { padding:5px 8px; border:none; border-bottom:1px solid #eee; font-size:11px; color:#333; }

  .cover-right { width:100mm; }
  .cover-company { font-size:11px; line-height:2.0; }
  .cover-company-name { font-size:15px; font-weight:700; color:#1e3a5f; margin-bottom:2px; }
  .cover-company-logo { font-size:18px; font-weight:800; color:#1e3a5f; letter-spacing:1px; margin-bottom:1px; }

  .cover-notes { margin-top:6mm; border-top:1px solid #ccc; padding-top:4mm; }
  .cover-notes-title { font-size:11px; font-weight:600; color:#555; margin-bottom:3px; }
  .cover-notes-body { font-size:10px; color:#666; line-height:1.8; }

  /* === テーブル共通 === */
  table { width:100%; border-collapse:collapse; }
  th { background:#1e3a5f; color:#fff; padding:7px 6px; font-size:11px; font-weight:600; text-align:center; border:1px solid #1e3a5f; }
  td { padding:5px 6px; font-size:11px; border:1px solid #e2e8f0; }
  tr:nth-child(even):not(.cat-header):not(.cat-subtotal) { background:#fafbfd; }

  /* === ページ2: サマリー === */
  .summary-page { padding:0; }
  .page-title { font-size:16px; font-weight:700; color:#1e3a5f; border-bottom:2px solid #1e3a5f; padding-bottom:6px; margin-bottom:16px; }
  .summary-table th { font-size:12px; padding:10px 8px; }
  .summary-table td { font-size:13px; }
  .summary-total td { background:#f0f4ff; font-weight:700; font-size:14px; border-top:2px solid #1e3a5f; }

  /* === ページ3: 明細 === */
  .detail-page { padding:0; }
  .detail-note { font-size:10px; color:#666; margin-top:16px; line-height:1.8; }
  .detail-total td { background:#f0f4ff; font-weight:700; font-size:12px; border-top:2px solid #1e3a5f; }

  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
  }
</style>
</head>
<body>

<!-- ========== ページ1: 表紙 ========== -->
<div class="page cover">
  <div class="cover-top">
    <div class="cover-date">発行日: ${dateStr}</div>
  </div>

  <div class="cover-title-wrap">
    <div class="cover-title">御 見 積 書</div>
  </div>

  <div class="cover-to">
    <span class="cover-customer-name">${project?.customer_name ?? ""}</span>
    <span class="cover-customer-suffix">御中</span>
  </div>

  <div class="cover-amount-wrap">
    <div class="cover-amount-label">御見積金額（税込）</div>
    <div class="cover-amount-box">
      <div class="cover-amount">${amountStr}</div>
    </div>
    <div class="cover-amount-note">うち消費税等 ${yenFmt(tax)}</div>
  </div>

  <div class="cover-body">
    <div class="cover-left">
      <table class="cover-detail-table">
        <tr><th>件名</th><td>${project?.project_name ?? ""}</td></tr>
        ${project?.site_address ? `<tr><th>現場住所</th><td>${project.site_address}</td></tr>` : ""}
        <tr><th>工事期間</th><td>別途ご相談</td></tr>
        <tr><th>有効期限</th><td>発行日より30日間</td></tr>
        <tr><th>お支払条件</th><td>完工後30日以内</td></tr>
      </table>
    </div>

    <div class="cover-right">
      <div class="cover-company">
        <div class="cover-company-logo">${companyLogoText}</div>
        <div class="cover-company-name">${companyName}</div>
        ${companyAddress ? `${companyAddress}<br>` : ""}
        ${companyPhone ? `TEL: ${companyPhone}<br>` : ""}
        ${companyInvoiceNumber ? `登録番号: ${companyInvoiceNumber}` : ""}
      </div>
    </div>
  </div>

  <div class="cover-notes">
    <div class="cover-notes-title">備考</div>
    <div class="cover-notes-body">
      ・上記金額には消費税（10%）が含まれております。<br>
      ・工事範囲・仕様の変更がある場合は別途お見積りいたします。<br>
      ・近隣への配慮を含め、安全管理を徹底いたします。
    </div>
  </div>
</div>

<!-- ========== ページ2: 大項目サマリー ========== -->
<div class="page summary-page">
  <div class="page-title">工事区分別 金額一覧</div>
  <table class="summary-table">
    <thead>
      <tr>
        <th style="width:50px">No</th>
        <th>工事区分</th>
        <th style="width:160px">金額</th>
      </tr>
    </thead>
    <tbody>
      ${summaryRows}
      <tr class="summary-total">
        <td colspan="2" style="text-align:right;padding-right:16px">合計（税抜）</td>
        <td style="text-align:right;color:#1e3a5f;font-size:16px">${yenFmt(total)}</td>
      </tr>
    </tbody>
  </table>
</div>

<!-- ========== ページ3以降: 明細 ========== -->
<div class="page detail-page">
  <div class="page-title">見積明細</div>
  <table>
    <thead>
      <tr>
        <th style="width:30px">No</th>
        <th>項目名</th>
        <th style="width:120px">仕様</th>
        <th style="width:45px">数量</th>
        <th style="width:35px">単位</th>
        <th style="width:80px">単価</th>
        <th style="width:90px">金額</th>
      </tr>
    </thead>
    <tbody>
      ${detailRows}
      <tr class="detail-total">
        <td colspan="6" style="text-align:right;padding-right:12px">総合計（税抜）</td>
        <td style="text-align:right;color:#1e3a5f;font-size:13px">${yenFmt(total)}</td>
      </tr>
    </tbody>
  </table>

  <div class="detail-note">
    ※ 上記金額は全て税抜価格です。別途消費税がかかります。<br>
    ※ 見積有効期限: 発行日より30日間<br>
    ※ 工事範囲・仕様の変更がある場合は別途お見積りいたします。
  </div>
</div>

</body>
</html>`;
}
