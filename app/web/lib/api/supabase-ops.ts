// ============================================================
// LinK Estimate OS — Supabase CRUD Operations
// 全関数はローカル版と同じシグネチャを維持
// ============================================================

import { createClient } from "../supabase/client";
import type {
  Customer, Vendor, WorkItemMaster, Project, ProjectItem,
  Invoice, Payment, ProjectListResponse, DashboardOverview,
  DashboardMonthlySalesPoint, DashboardActiveProject,
} from "./types";

function supabase() { return createClient(); }

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function ymd(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function getOrgId(): Promise<string> {
  const sb = supabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("認証が必要です");
  const { data: profile } = await sb
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("プロフィールが見つかりません");
  return profile.org_id;
}

// ============================================================
// Row ↔ App type マッピング
// Supabase rows use uuid ids, app types use string ids like "C-001"
// ============================================================

function toCustomer(row: Record<string, unknown>): Customer {
  return {
    customer_id: row.id as string,
    customer_name: row.customer_name as string,
    contact_name: row.contact_name as string | null,
    phone: row.phone as string | null,
    monthly_volume: row.monthly_volume as string | null,
    status: row.status as string,
  };
}

function toVendor(row: Record<string, unknown>): Vendor {
  return {
    vendor_id: row.id as string,
    vendor_name: row.vendor_name as string,
    vendor_type: row.vendor_type as "subcontractor" | "supplier",
    specialty: row.specialty as string | null,
    annual_order_amount: safeNum(row.annual_order_amount),
    markup_rate: row.markup_rate != null ? safeNum(row.markup_rate) : null,
    phone: row.phone as string | null,
    note: row.note as string | null,
  };
}

function toWorkItem(row: Record<string, unknown>): WorkItemMaster {
  return {
    id: safeNum(row.id),
    category: row.category as string,
    item_name: row.item_name as string,
    specification: row.specification as string | null,
    unit: row.unit as string,
    cost_price: safeNum(row.cost_price),
    selling_price: safeNum(row.selling_price),
    vendor_id: row.vendor_id as string | null,
  };
}

function toProject(row: Record<string, unknown>): Project {
  return {
    project_id: row.id as string,
    customer_id: (row.customer_id ?? "") as string,
    customer_name: row.customer_name as string,
    project_name: row.project_name as string,
    site_address: row.site_address as string | null,
    owner_name: row.owner_name as string,
    project_status: row.project_status as string,
    created_at: (row.created_at as string).slice(0, 10),
    estimated_start: row.estimated_start as string | null,
    estimated_end: row.estimated_end as string | null,
    note: row.note as string | null,
  };
}

function toProjectItem(row: Record<string, unknown>): ProjectItem {
  return {
    id: safeNum(row.id),
    project_id: row.project_id as string,
    category: row.category as string,
    item_name: row.item_name as string,
    specification: row.specification as string | null,
    unit: row.unit as string,
    quantity: safeNum(row.quantity),
    cost_price: safeNum(row.cost_price),
    selling_price: safeNum(row.selling_price),
    vendor_id: row.vendor_id as string | null,
    sort_order: safeNum(row.sort_order),
  };
}

function toInvoice(row: Record<string, unknown>): Invoice {
  return {
    invoice_id: row.id as string,
    project_id: row.project_id as string,
    invoice_amount: safeNum(row.invoice_amount),
    billed_at: row.billed_at as string,
    due_date: row.due_date as string,
    paid_amount: safeNum(row.paid_amount),
    remaining_amount: safeNum(row.remaining_amount),
    status: row.status as string,
    note: row.note as string | null,
  };
}

function toPayment(row: Record<string, unknown>): Payment {
  return {
    payment_id: row.id as string,
    project_id: row.project_id as string,
    vendor_id: row.vendor_id as string | null,
    vendor_name: row.vendor_name as string,
    work_description: row.work_description as string | null,
    ordered_amount: safeNum(row.ordered_amount),
    paid_amount: safeNum(row.paid_amount),
    remaining_amount: safeNum(row.remaining_amount),
    status: row.status as string,
    paid_at: row.paid_at as string | null,
    note: row.note as string | null,
  };
}

// ============================================================
// Customers
// ============================================================

export async function sbGetCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase()
    .from("customers")
    .select("*")
    .order("customer_name");
  if (error) throw new Error("顧客一覧取得失敗: " + error.message);
  return (data ?? []).map(toCustomer);
}

// ============================================================
// Vendors
// ============================================================

export async function sbGetVendors(): Promise<Vendor[]> {
  const { data, error } = await supabase()
    .from("vendors")
    .select("*")
    .order("vendor_name");
  if (error) throw new Error("仕入先一覧取得失敗: " + error.message);
  return (data ?? []).map(toVendor);
}

// ============================================================
// Work Items
// ============================================================

export async function sbGetWorkItems(): Promise<WorkItemMaster[]> {
  const { data, error } = await supabase()
    .from("work_items")
    .select("*")
    .order("sort_order")
    .order("category");
  if (error) throw new Error("工事項目取得失敗: " + error.message);
  return (data ?? []).map(toWorkItem);
}

// ============================================================
// Projects
// ============================================================

export async function sbGetProjects(params?: { customer_id?: string; status?: string }): Promise<ProjectListResponse> {
  let query = supabase()
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (params?.customer_id) query = query.eq("customer_id", params.customer_id);
  if (params?.status) query = query.eq("project_status", params.status);

  const { data, error } = await query;
  if (error) throw new Error("案件一覧取得失敗: " + error.message);
  const items = (data ?? []).map(toProject);
  return { items, total: items.length };
}

export async function sbGetProject(projectId: string): Promise<Project> {
  const { data, error } = await supabase()
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();
  if (error || !data) throw new Error("案件が存在しません");
  return toProject(data);
}

export async function sbCreateProject(payload: {
  customer_id: string;
  project_name: string;
  site_address?: string;
  owner_name?: string;
}): Promise<Project> {
  const orgId = await getOrgId();
  // 顧客名を取得
  const { data: customer } = await supabase()
    .from("customers")
    .select("customer_name")
    .eq("id", payload.customer_id)
    .single();

  const { data, error } = await supabase()
    .from("projects")
    .insert({
      org_id: orgId,
      customer_id: payload.customer_id,
      customer_name: customer?.customer_name ?? "未設定",
      project_name: (payload.project_name || "案件").trim(),
      site_address: payload.site_address?.trim() || null,
      owner_name: payload.owner_name?.trim() || "",
      project_status: "見積中",
    })
    .select()
    .single();
  if (error || !data) throw new Error("案件作成失敗: " + (error?.message ?? ""));
  return toProject(data);
}

export async function sbCreateProjectQuick(payload: {
  customer_name: string;
  project_name: string;
  site_address?: string;
}): Promise<Project> {
  const orgId = await getOrgId();
  const sb = supabase();

  // 既存顧客を検索
  const { data: existingCustomers } = await sb
    .from("customers")
    .select("id, customer_name")
    .eq("customer_name", payload.customer_name.trim());

  let customerId: string;
  let customerName: string;

  if (existingCustomers && existingCustomers.length > 0) {
    customerId = existingCustomers[0].id;
    customerName = existingCustomers[0].customer_name;
  } else {
    // 新規顧客作成
    const { data: newCustomer, error: custError } = await sb
      .from("customers")
      .insert({
        org_id: orgId,
        customer_name: payload.customer_name.trim(),
        status: "取引中",
      })
      .select()
      .single();
    if (custError || !newCustomer) throw new Error("顧客作成失敗");
    customerId = newCustomer.id;
    customerName = newCustomer.customer_name;
  }

  // ユーザー名を取得
  const { data: { user } } = await sb.auth.getUser();
  const { data: profile } = await sb
    .from("profiles")
    .select("display_name")
    .eq("id", user!.id)
    .single();

  const { data, error } = await sb
    .from("projects")
    .insert({
      org_id: orgId,
      customer_id: customerId,
      customer_name: customerName,
      project_name: (payload.project_name || "案件").trim(),
      site_address: payload.site_address?.trim() || null,
      owner_name: profile?.display_name ?? "",
      project_status: "見積中",
    })
    .select()
    .single();
  if (error || !data) throw new Error("案件作成失敗: " + (error?.message ?? ""));
  return toProject(data);
}

export async function sbUpdateProjectStatus(projectId: string, status: string): Promise<Project> {
  const { data, error } = await supabase()
    .from("projects")
    .update({ project_status: status })
    .eq("id", projectId)
    .select()
    .single();
  if (error || !data) throw new Error("ステータス更新失敗");
  return toProject(data);
}

// ============================================================
// Project Items
// ============================================================

export async function sbGetProjectItems(projectId: string): Promise<ProjectItem[]> {
  const { data, error } = await supabase()
    .from("project_items")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");
  if (error) throw new Error("明細取得失敗: " + error.message);
  return (data ?? []).map(toProjectItem);
}

export async function sbCreateProjectItem(
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
    vendor_id?: string;
  },
): Promise<ProjectItem> {
  const orgId = await getOrgId();
  const sb = supabase();

  let master: Record<string, unknown> | null = null;
  if (payload.master_item_id) {
    const { data } = await sb
      .from("work_items")
      .select("*")
      .eq("id", payload.master_item_id)
      .single();
    master = data;
  }

  // 最大sort_order取得
  const { data: maxRow } = await sb
    .from("project_items")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();
  const nextOrder = (maxRow ? safeNum(maxRow.sort_order) : -1) + 1;

  const { data, error } = await sb
    .from("project_items")
    .insert({
      org_id: orgId,
      project_id: projectId,
      category: payload.category ?? (master?.category as string) ?? "その他",
      item_name: payload.item_name ?? (master?.item_name as string) ?? "項目",
      specification: payload.specification ?? (master?.specification as string | null) ?? null,
      unit: payload.unit ?? (master?.unit as string) ?? "式",
      quantity: safeNum(payload.quantity || 1),
      cost_price: safeNum(payload.cost_price ?? (master?.cost_price as number) ?? 0),
      selling_price: safeNum(payload.selling_price ?? (master?.selling_price as number) ?? 0),
      vendor_id: payload.vendor_id ?? (master?.vendor_id as string | null) ?? null,
      sort_order: nextOrder,
    })
    .select()
    .single();
  if (error || !data) throw new Error("明細追加失敗: " + (error?.message ?? ""));
  return toProjectItem(data);
}

export async function sbUpdateProjectItem(
  _projectId: string,
  itemId: number,
  payload: Partial<Pick<ProjectItem, "quantity" | "cost_price" | "selling_price" | "item_name" | "specification" | "unit">>,
): Promise<ProjectItem> {
  const updates: Record<string, unknown> = {};
  if (payload.quantity !== undefined) updates.quantity = safeNum(payload.quantity);
  if (payload.cost_price !== undefined) updates.cost_price = safeNum(payload.cost_price);
  if (payload.selling_price !== undefined) updates.selling_price = safeNum(payload.selling_price);
  if (payload.item_name !== undefined) updates.item_name = payload.item_name;
  if (payload.specification !== undefined) updates.specification = payload.specification;
  if (payload.unit !== undefined) updates.unit = payload.unit;

  const { data, error } = await supabase()
    .from("project_items")
    .update(updates)
    .eq("id", itemId)
    .select()
    .single();
  if (error || !data) throw new Error("明細更新失敗");
  return toProjectItem(data);
}

export async function sbDeleteProjectItem(_projectId: string, itemId: number): Promise<void> {
  const { error } = await supabase()
    .from("project_items")
    .delete()
    .eq("id", itemId);
  if (error) throw new Error("明細削除失敗");
}

export async function sbReorderProjectItems(projectId: string, itemIds: number[]): Promise<void> {
  const sb = supabase();
  for (let i = 0; i < itemIds.length; i++) {
    await sb
      .from("project_items")
      .update({ sort_order: i })
      .eq("id", itemIds[i])
      .eq("project_id", projectId);
  }
}

// ============================================================
// Invoices
// ============================================================

function invoiceStatus(amount: number, paid: number) {
  if (amount <= 0) return "未請求";
  if (paid >= amount) return "入金済";
  if (paid > 0) return "一部入金";
  return "未入金";
}

export async function sbGetInvoices(projectId?: string): Promise<Invoice[]> {
  let query = supabase().from("invoices").select("*").order("billed_at", { ascending: false });
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query;
  if (error) throw new Error("請求一覧取得失敗");
  return (data ?? []).map(toInvoice);
}

export async function sbCreateInvoice(payload: {
  project_id: string;
  invoice_amount: number;
  billed_at?: string;
  due_date?: string;
  paid_amount?: number;
  note?: string;
}): Promise<Invoice> {
  const orgId = await getOrgId();
  const amount = safeNum(payload.invoice_amount);
  const paid = safeNum(payload.paid_amount ?? 0);
  const billedAt = payload.billed_at ?? ymd();
  const dueDate = payload.due_date ?? (() => {
    const d = new Date(billedAt);
    d.setDate(d.getDate() + 30);
    return ymd(d);
  })();

  const { data, error } = await supabase()
    .from("invoices")
    .insert({
      org_id: orgId,
      project_id: payload.project_id,
      invoice_amount: amount,
      billed_at: billedAt,
      due_date: dueDate,
      paid_amount: paid,
      remaining_amount: Math.max(amount - paid, 0),
      status: invoiceStatus(amount, paid),
      note: payload.note ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new Error("請求登録失敗: " + (error?.message ?? ""));
  return toInvoice(data);
}

export async function sbUpdateInvoice(
  invoiceId: string,
  payload: { paid_amount?: number; invoice_amount?: number; note?: string },
): Promise<Invoice> {
  // 現在の値を取得
  const { data: current } = await supabase()
    .from("invoices")
    .select("invoice_amount, paid_amount")
    .eq("id", invoiceId)
    .single();
  if (!current) throw new Error("請求が存在しません");

  const amount = payload.invoice_amount !== undefined ? safeNum(payload.invoice_amount) : safeNum(current.invoice_amount);
  const paid = payload.paid_amount !== undefined ? safeNum(payload.paid_amount) : safeNum(current.paid_amount);

  const updates: Record<string, unknown> = {
    remaining_amount: Math.max(amount - paid, 0),
    status: invoiceStatus(amount, paid),
  };
  if (payload.invoice_amount !== undefined) updates.invoice_amount = amount;
  if (payload.paid_amount !== undefined) updates.paid_amount = paid;
  if (payload.note !== undefined) updates.note = payload.note;

  const { data, error } = await supabase()
    .from("invoices")
    .update(updates)
    .eq("id", invoiceId)
    .select()
    .single();
  if (error || !data) throw new Error("請求更新失敗");
  return toInvoice(data);
}

// ============================================================
// Payments
// ============================================================

function paymentStatus(ordered: number, paid: number) {
  if (ordered <= 0) return "未発注";
  if (paid >= ordered) return "支払済";
  if (paid > 0) return "一部支払";
  return "未支払";
}

export async function sbGetPayments(projectId?: string): Promise<Payment[]> {
  let query = supabase().from("payments").select("*").order("created_at", { ascending: false });
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query;
  if (error) throw new Error("支払一覧取得失敗");
  return (data ?? []).map(toPayment);
}

export async function sbCreatePayment(payload: {
  project_id: string;
  vendor_id?: string;
  vendor_name?: string;
  work_description?: string;
  ordered_amount: number;
  paid_amount?: number;
  note?: string;
}): Promise<Payment> {
  const orgId = await getOrgId();
  const ordered = safeNum(payload.ordered_amount);
  const paid = safeNum(payload.paid_amount ?? 0);

  const { data, error } = await supabase()
    .from("payments")
    .insert({
      org_id: orgId,
      project_id: payload.project_id,
      vendor_id: payload.vendor_id ?? null,
      vendor_name: payload.vendor_name ?? "未設定",
      work_description: payload.work_description ?? null,
      ordered_amount: ordered,
      paid_amount: paid,
      remaining_amount: Math.max(ordered - paid, 0),
      status: paymentStatus(ordered, paid),
      note: payload.note ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new Error("支払登録失敗: " + (error?.message ?? ""));
  return toPayment(data);
}

export async function sbUpdatePayment(
  paymentId: string,
  payload: { paid_amount?: number; ordered_amount?: number; note?: string },
): Promise<Payment> {
  const { data: current } = await supabase()
    .from("payments")
    .select("ordered_amount, paid_amount")
    .eq("id", paymentId)
    .single();
  if (!current) throw new Error("支払が存在しません");

  const ordered = payload.ordered_amount !== undefined ? safeNum(payload.ordered_amount) : safeNum(current.ordered_amount);
  const paid = payload.paid_amount !== undefined ? safeNum(payload.paid_amount) : safeNum(current.paid_amount);

  const updates: Record<string, unknown> = {
    remaining_amount: Math.max(ordered - paid, 0),
    status: paymentStatus(ordered, paid),
  };
  if (payload.ordered_amount !== undefined) updates.ordered_amount = ordered;
  if (payload.paid_amount !== undefined) updates.paid_amount = paid;
  if (payload.note !== undefined) updates.note = payload.note;

  const { data, error } = await supabase()
    .from("payments")
    .update(updates)
    .eq("id", paymentId)
    .select()
    .single();
  if (error || !data) throw new Error("支払更新失敗");
  return toPayment(data);
}

// ============================================================
// Dashboard
// ============================================================

export async function sbGetDashboardOverview(): Promise<DashboardOverview> {
  const sb = supabase();

  const [
    { data: projects },
    { data: projectItems },
    { data: invoices },
    { data: payments },
  ] = await Promise.all([
    sb.from("projects").select("*"),
    sb.from("project_items").select("*"),
    sb.from("invoices").select("*"),
    sb.from("payments").select("*"),
  ]);

  const allProjects = (projects ?? []) as Record<string, unknown>[];
  const allItems = (projectItems ?? []) as Record<string, unknown>[];
  const allInvoices = (invoices ?? []) as Record<string, unknown>[];
  const allPayments = (payments ?? []) as Record<string, unknown>[];

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const monthly: DashboardMonthlySalesPoint[] = Array.from({ length: 12 }, (_, i) => ({
    month: `${i + 1}月`, amount: 0, cost: 0, margin: 0,
  }));

  let current_month_sales = 0;
  let ytd_sales = 0;
  let last_year_ytd_sales = 0;
  let all_time_sales = 0;

  for (const inv of allInvoices) {
    const billedStr = inv.billed_at as string;
    if (!billedStr) continue;
    const billed = new Date(billedStr);
    if (isNaN(billed.getTime())) continue;
    const amount = safeNum(inv.invoice_amount);
    all_time_sales += amount;
    if (billed.getFullYear() === currentYear) {
      monthly[billed.getMonth()].amount += amount;
      if (billed.getMonth() === currentMonth) current_month_sales += amount;
      if (billed <= today) ytd_sales += amount;
    } else if (billed.getFullYear() === currentYear - 1) {
      const lastYearSameDay = new Date(today);
      lastYearSameDay.setFullYear(currentYear - 1);
      if (billed <= lastYearSameDay) last_year_ytd_sales += amount;
    }
  }

  const projectSelling = new Map<string, number>();
  const projectCost = new Map<string, number>();
  for (const item of allItems) {
    const pid = item.project_id as string;
    const s = safeNum(item.selling_price) * safeNum(item.quantity);
    const c = safeNum(item.cost_price) * safeNum(item.quantity);
    projectSelling.set(pid, (projectSelling.get(pid) ?? 0) + s);
    projectCost.set(pid, (projectCost.get(pid) ?? 0) + c);
  }

  let all_time_cost = 0;
  for (const c of projectCost.values()) all_time_cost += c;
  let all_time_selling = 0;
  for (const s of projectSelling.values()) all_time_selling += s;

  let next_month_projection = 0;
  let pipeline_total = 0;
  let pipeline_count = 0;
  const statusCounts: Record<string, number> = {};

  for (const p of allProjects) {
    const status = p.project_status as string;
    const pid = p.id as string;
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    const selling = projectSelling.get(pid) ?? 0;
    if (status === "見積中" || status === "受注") {
      pipeline_total += selling;
      pipeline_count++;
    }
    if (status === "受注" || status === "施工中") {
      next_month_projection += selling;
    }
  }

  const receivable_balance = allInvoices.reduce((s, x) => s + safeNum(x.remaining_amount), 0);
  const payable_balance = allPayments.reduce((s, x) => s + safeNum(x.remaining_amount), 0);

  const yoy_growth_rate = last_year_ytd_sales > 0
    ? ((ytd_sales - last_year_ytd_sales) / last_year_ytd_sales) * 100 : 0;

  const avg_margin_rate = all_time_selling > 0
    ? ((all_time_selling - all_time_cost) / all_time_selling) * 100 : 0;

  const activeStatuses = new Set(["見積中", "受注", "施工中", "請求済"]);
  const active_projects: DashboardActiveProject[] = allProjects
    .filter((p) => activeStatuses.has(p.project_status as string))
    .map((p) => {
      const pid = p.id as string;
      const selling = projectSelling.get(pid) ?? 0;
      const cost = projectCost.get(pid) ?? 0;
      return {
        project_id: pid,
        project_name: p.project_name as string,
        customer_name: p.customer_name as string,
        project_status: p.project_status as string,
        selling_total: selling,
        cost_total: cost,
        margin: selling - cost,
        margin_rate: selling > 0 ? ((selling - cost) / selling) * 100 : 0,
        created_at: (p.created_at as string).slice(0, 10),
      };
    });

  const vendorTotals = new Map<string, { amount: number; count: number }>();
  for (const pay of allPayments) {
    const name = pay.vendor_name as string;
    const existing = vendorTotals.get(name) ?? { amount: 0, count: 0 };
    existing.amount += safeNum(pay.ordered_amount);
    existing.count += 1;
    vendorTotals.set(name, existing);
  }
  const top_vendors = Array.from(vendorTotals.entries())
    .map(([vendor_name, v]) => ({ vendor_name, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    current_month_sales,
    next_month_projection,
    pipeline_total,
    pipeline_count,
    ytd_sales,
    last_year_ytd_sales,
    yoy_growth_rate,
    receivable_balance,
    payable_balance,
    cash_position: receivable_balance - payable_balance,
    avg_margin_rate,
    all_time_sales,
    all_time_cost,
    all_time_margin: all_time_selling - all_time_cost,
    active_project_count: active_projects.length,
    status_counts: statusCounts,
    monthly_sales: monthly,
    active_projects,
    top_vendors,
  };
}

// ============================================================
// Organization info (for PDF)
// ============================================================
export type OrgInfo = {
  name: string;
  address: string;
  phone: string;
  invoice_number: string;
  bank_info: string;
};

export async function sbGetOrgInfo(): Promise<OrgInfo> {
  const orgId = await getOrgId();
  const { data, error } = await supabase()
    .from("organizations")
    .select("name, address, phone, invoice_number, bank_info")
    .eq("id", orgId)
    .single();
  if (error || !data) return { name: "", address: "", phone: "", invoice_number: "", bank_info: "" };
  return data as OrgInfo;
}
