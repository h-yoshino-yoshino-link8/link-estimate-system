// ============================================================
// LinK Estimate OS — Shared Type Definitions
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
