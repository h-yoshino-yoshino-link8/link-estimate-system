// ============================================================
// LinK Estimate OS — Shared Type Definitions
// ============================================================

export type Customer = {
  customer_id: string;
  customer_name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
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
  assigned_staff_id?: string | null;
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

export type CustomerRankingItem = {
  customer_id: string;
  customer_name: string;
  total_sales: number;
  total_cost: number;
  total_profit: number;
  project_count: number;
  margin_rate: number;
};

export type YoYMonthlyPoint = {
  month: number;
  current_year: number;
  previous_year: number;
  diff: number;
  diff_rate: number;
};

export type StaffPerformance = {
  staff_id: string;
  display_name: string;
  project_count: number;
  total_sales: number;
  total_cost: number;
  total_profit: number;
  margin_rate: number;
};

export type StaffMonthlyTarget = {
  id?: string;
  staff_id: string;
  year: number;
  month: number;
  target_sales: number;
  target_profit: number;
  target_projects: number;
};

export type StaffTargetVsActual = {
  staff_id: string;
  display_name: string;
  target_sales: number;
  target_profit: number;
  target_projects: number;
  actual_sales: number;
  actual_profit: number;
  actual_projects: number;
  achievement_rate: number;
};

export type StaffMember = {
  id: string;
  display_name: string;
  role: string;
};

export type AgingBucket = {
  label: string;
  count: number;
  total_amount: number;
};

export type UnpaidInvoice = {
  invoice_id: string;
  project_id: string;
  project_name: string;
  customer_name: string;
  customer_email?: string | null;
  invoice_amount: number;
  remaining_amount: number;
  due_date: string;
  days_overdue: number;
  aging_category: string;
};

export type CollectionMetrics = {
  dso: number;
  collection_rate: number;
  total_receivable: number;
  total_overdue: number;
  overdue_count: number;
  aging_buckets: AgingBucket[];
};

/* ── Project A: 検索・集計・エクスポート ── */

export type CustomerDetail = {
  customer: Customer;
  projects: Project[];
  total_sales: number;
  total_cost: number;
  total_profit: number;
  margin_rate: number;
  project_count: number;
  monthly_sales: { month: string; amount: number }[];
};

export type InvoiceWithProject = Invoice & {
  project_name: string;
  customer_name: string;
};

export type PaymentWithProject = Payment & {
  project_name: string;
};

/* ── Project B: 管理者向けシステム管理 ── */

export type TableStat = {
  table_name: string;
  display_name: string;
  count: number;
  description: string;
};

export type UserProfile = {
  id: string;
  display_name: string;
  role: string;
};

export type EmailLog = {
  id: string;
  to_email: string;
  subject: string;
  status: string;
  error_message?: string | null;
  sent_at: string;
};

/* ── Phase 2: 銀行融資指標 ── */

export type MonthlyKpi = {
  year: number;
  month: number;
  total_sales: number;
  total_cost: number;
  gross_profit: number;
  gross_margin_rate: number;
  project_count: number;
  invoice_count: number;
  collection_amount: number;
  receivable_balance: number;
  payable_balance: number;
  cash_position: number;
  dso: number;
};

export type MonthlyMarginTrend = {
  month: string;           // "2026-01" format
  sales: number;
  cost: number;
  gross_profit: number;
  gross_margin_rate: number;
};

export type CashPositionPoint = {
  month: string;           // "2026-01" format
  receivable: number;
  payable: number;
  cash_position: number;
};

export type BankDashboardData = {
  monthly_margin_trend: MonthlyMarginTrend[];
  cash_position_trend: CashPositionPoint[];
  dso: number;
  dso_trend: { month: string; dso: number }[];
  current_ratio: number;     // 売掛/買掛比率
  avg_collection_days: number;
  avg_payment_days: number;
  working_capital: number;   // 運転資金 = 売掛 - 買掛
};
