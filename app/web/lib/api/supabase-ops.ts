// ============================================================
// LinK Estimate OS — Supabase CRUD Operations
// 全関数はローカル版と同じシグネチャを維持
// ============================================================

import { createClient } from "../supabase/client";
import type {
  Customer, Vendor, WorkItemMaster, Project, ProjectItem,
  Invoice, Payment, ProjectListResponse, DashboardOverview,
  DashboardMonthlySalesPoint, DashboardActiveProject,
  CustomerRankingItem, YoYMonthlyPoint, StaffPerformance,
  StaffMonthlyTarget, StaffTargetVsActual, StaffMember,
  CollectionMetrics, UnpaidInvoice,
  BankDashboardData, MonthlyMarginTrend, CashPositionPoint,
} from "./types";

function supabase() { return createClient(); }

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function ymd(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// セッション内キャッシュ（同一ページロード内で重複クエリを防止）
let _cachedOrgId: string | null = null;
let _cachedUserId: string | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 60秒

export async function getOrgId(): Promise<string> {
  // 開発バイパス: RLS無効時にAuth不要でテスト可能にする
  const devOrgId = process.env.NEXT_PUBLIC_DEV_ORG_ID;
  if (devOrgId) {
    _cachedOrgId = devOrgId;
    return devOrgId;
  }

  const now = Date.now();
  if (_cachedOrgId && now - _cacheTimestamp < CACHE_TTL) return _cachedOrgId;

  const sb = supabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("認証が必要です");
  const { data: profile } = await sb
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("プロフィールが見つかりません");
  _cachedOrgId = profile.org_id;
  _cachedUserId = user.id;
  _cacheTimestamp = now;
  return profile.org_id;
}

function getCachedUserId(): string | null { return _cachedUserId; }

// ログアウト時にキャッシュクリア
export function clearOrgIdCache(): void {
  _cachedOrgId = null;
  _cachedUserId = null;
  _cacheTimestamp = 0;
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
    email: (row.email as string | null) ?? null,
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
    created_at: row.created_at ? (row.created_at as string).slice(0, 10) : ymd(),
    estimated_start: row.estimated_start as string | null,
    estimated_end: row.estimated_end as string | null,
    note: row.note as string | null,
    assigned_staff_id: row.assigned_staff_id as string | null,
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

export async function sbCreateCustomer(payload: {
  customer_name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  monthly_volume?: string;
  status?: string;
}): Promise<Customer> {
  const orgId = await getOrgId();
  const { data, error } = await supabase()
    .from("customers")
    .insert({
      org_id: orgId,
      customer_name: payload.customer_name.trim(),
      contact_name: payload.contact_name?.trim() || null,
      phone: payload.phone?.trim() || null,
      email: payload.email?.trim() || null,
      monthly_volume: payload.monthly_volume?.trim() || null,
      status: payload.status ?? "取引中",
    })
    .select()
    .single();
  if (error || !data) throw new Error("顧客作成失敗: " + (error?.message ?? ""));
  return toCustomer(data);
}

export async function sbUpdateCustomer(customerId: string, payload: Partial<{
  customer_name: string;
  contact_name: string;
  phone: string;
  email: string;
  monthly_volume: string;
  status: string;
}>): Promise<Customer> {
  const updates: Record<string, unknown> = {};
  if (payload.customer_name !== undefined) updates.customer_name = payload.customer_name.trim();
  if (payload.contact_name !== undefined) updates.contact_name = payload.contact_name.trim() || null;
  if (payload.phone !== undefined) updates.phone = payload.phone.trim() || null;
  if (payload.email !== undefined) updates.email = payload.email.trim() || null;
  if (payload.monthly_volume !== undefined) updates.monthly_volume = payload.monthly_volume.trim() || null;
  if (payload.status !== undefined) updates.status = payload.status;

  const { data, error } = await supabase()
    .from("customers")
    .update(updates)
    .eq("id", customerId)
    .select()
    .single();
  if (error || !data) throw new Error("顧客更新失敗: " + (error?.message ?? ""));
  return toCustomer(data);
}

export async function sbDeleteCustomer(customerId: string): Promise<void> {
  const { error } = await supabase()
    .from("customers")
    .delete()
    .eq("id", customerId);
  if (error) throw new Error("顧客削除失敗: " + error.message);
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

export async function sbCreateVendor(payload: {
  vendor_name: string;
  vendor_type?: "subcontractor" | "supplier";
  specialty?: string;
  phone?: string;
  note?: string;
}): Promise<Vendor> {
  const orgId = await getOrgId();
  const { data, error } = await supabase()
    .from("vendors")
    .insert({
      org_id: orgId,
      vendor_name: payload.vendor_name.trim(),
      vendor_type: payload.vendor_type ?? "subcontractor",
      specialty: payload.specialty?.trim() || null,
      phone: payload.phone?.trim() || null,
      note: payload.note?.trim() || null,
      annual_order_amount: 0,
      markup_rate: null,
    })
    .select()
    .single();
  if (error || !data) throw new Error("仕入先作成失敗: " + (error?.message ?? ""));
  return toVendor(data);
}

export async function sbUpdateVendor(vendorId: string, payload: Partial<{
  vendor_name: string;
  vendor_type: "subcontractor" | "supplier";
  specialty: string;
  phone: string;
  note: string;
  markup_rate: number | null;
}>): Promise<Vendor> {
  const updates: Record<string, unknown> = {};
  if (payload.vendor_name !== undefined) updates.vendor_name = payload.vendor_name.trim();
  if (payload.vendor_type !== undefined) updates.vendor_type = payload.vendor_type;
  if (payload.specialty !== undefined) updates.specialty = payload.specialty.trim() || null;
  if (payload.phone !== undefined) updates.phone = payload.phone.trim() || null;
  if (payload.note !== undefined) updates.note = payload.note.trim() || null;
  if (payload.markup_rate !== undefined) updates.markup_rate = payload.markup_rate;

  const { data, error } = await supabase()
    .from("vendors")
    .update(updates)
    .eq("id", vendorId)
    .select()
    .single();
  if (error || !data) throw new Error("仕入先更新失敗: " + (error?.message ?? ""));
  return toVendor(data);
}

export async function sbDeleteVendor(vendorId: string): Promise<void> {
  const { error } = await supabase()
    .from("vendors")
    .delete()
    .eq("id", vendorId);
  if (error) throw new Error("仕入先削除失敗: " + error.message);
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

export async function sbCreateWorkItem(payload: {
  category: string;
  item_name: string;
  specification?: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  vendor_id?: string;
}): Promise<WorkItemMaster> {
  const orgId = await getOrgId();
  const sb = supabase();

  // 最大sort_order取得
  const { data: maxRow } = await sb
    .from("work_items")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow ? safeNum(maxRow.sort_order) : -1) + 1;

  const { data, error } = await sb
    .from("work_items")
    .insert({
      org_id: orgId,
      category: payload.category.trim(),
      item_name: payload.item_name.trim(),
      specification: payload.specification?.trim() || null,
      unit: payload.unit.trim(),
      cost_price: safeNum(payload.cost_price),
      selling_price: safeNum(payload.selling_price),
      vendor_id: payload.vendor_id || null,
      sort_order: nextOrder,
    })
    .select()
    .single();
  if (error || !data) throw new Error("工事項目作成失敗: " + (error?.message ?? ""));
  return toWorkItem(data);
}

export async function sbUpdateWorkItem(itemId: number, payload: Partial<{
  category: string;
  item_name: string;
  specification: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  vendor_id: string | null;
}>): Promise<WorkItemMaster> {
  const updates: Record<string, unknown> = {};
  if (payload.category !== undefined) updates.category = payload.category.trim();
  if (payload.item_name !== undefined) updates.item_name = payload.item_name.trim();
  if (payload.specification !== undefined) updates.specification = payload.specification.trim() || null;
  if (payload.unit !== undefined) updates.unit = payload.unit.trim();
  if (payload.cost_price !== undefined) updates.cost_price = safeNum(payload.cost_price);
  if (payload.selling_price !== undefined) updates.selling_price = safeNum(payload.selling_price);
  if (payload.vendor_id !== undefined) updates.vendor_id = payload.vendor_id || null;

  const { data, error } = await supabase()
    .from("work_items")
    .update(updates)
    .eq("id", itemId)
    .select()
    .single();
  if (error || !data) throw new Error("工事項目更新失敗: " + (error?.message ?? ""));
  return toWorkItem(data);
}

export async function sbDeleteWorkItem(itemId: number): Promise<void> {
  const { error } = await supabase()
    .from("work_items")
    .delete()
    .eq("id", itemId);
  if (error) throw new Error("工事項目削除失敗: " + error.message);
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

  // ユーザー名を取得（getOrgId()で既にキャッシュ済み）
  const userId = getCachedUserId();
  const { data: profile } = await sb
    .from("profiles")
    .select("display_name")
    .eq("id", userId!)
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
    .maybeSingle();
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

export async function sbDeleteProjectItem(projectId: string, itemId: number): Promise<void> {
  const { error } = await supabase()
    .from("project_items")
    .delete()
    .eq("id", itemId)
    .eq("project_id", projectId);
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

export type OrgSettings = {
  name: string;
  postal_code: string;
  address: string;
  phone: string;
  fax: string;
  email: string;
  invoice_number: string;
  bank_info: string;
  logo_url: string;
  notes: string;
};

export async function sbGetOrgSettings(): Promise<OrgSettings> {
  const orgId = await getOrgId();
  const { data, error } = await supabase()
    .from("organizations")
    .select("name, postal_code, address, phone, fax, email, invoice_number, bank_info, logo_url, notes")
    .eq("id", orgId)
    .single();
  if (error || !data) return { name: "", postal_code: "", address: "", phone: "", fax: "", email: "", invoice_number: "", bank_info: "", logo_url: "", notes: "" };
  return data as OrgSettings;
}

export async function sbUpdateOrgSettings(settings: Partial<OrgSettings>): Promise<OrgSettings> {
  const orgId = await getOrgId();
  const { data, error } = await supabase()
    .from("organizations")
    .update(settings)
    .eq("id", orgId)
    .select("name, postal_code, address, phone, fax, email, invoice_number, bank_info, logo_url, notes")
    .single();
  if (error || !data) throw new Error("会社情報の更新に失敗しました: " + (error?.message ?? ""));
  return data as OrgSettings;
}

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

// ============================================================
// Staff Members
// ============================================================

export async function sbGetStaffMembers(): Promise<StaffMember[]> {
  const orgId = await getOrgId();
  const { data, error } = await supabase()
    .from("profiles")
    .select("id, display_name, role")
    .eq("org_id", orgId)
    .order("display_name");
  if (error) throw new Error("スタッフ一覧取得失敗: " + error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    display_name: (row.display_name as string) || "未設定",
    role: (row.role as string) || "",
  }));
}

// ============================================================
// Customer Ranking
// ============================================================

export async function sbGetCustomerRanking(period?: { from?: string; to?: string }): Promise<CustomerRankingItem[]> {
  const sb = supabase();

  const [{ data: projects }, { data: projectItems }, { data: invoices }] = await Promise.all([
    sb.from("projects").select("id, customer_id, customer_name"),
    sb.from("project_items").select("project_id, quantity, cost_price, selling_price"),
    sb.from("invoices").select("project_id, invoice_amount, billed_at"),
  ]);

  const allProjects = (projects ?? []) as Record<string, unknown>[];
  const allItems = (projectItems ?? []) as Record<string, unknown>[];
  const allInvoices = (invoices ?? []) as Record<string, unknown>[];

  // 期間内の請求から対象プロジェクトを判定
  const projectInvoiceMap = new Map<string, number>();
  for (const inv of allInvoices) {
    const billedAt = inv.billed_at as string;
    if (period?.from && billedAt < period.from) continue;
    if (period?.to && billedAt > period.to) continue;
    const pid = inv.project_id as string;
    projectInvoiceMap.set(pid, (projectInvoiceMap.get(pid) ?? 0) + safeNum(inv.invoice_amount));
  }

  // プロジェクトごとの原価
  const projectCostMap = new Map<string, number>();
  const projectSellingMap = new Map<string, number>();
  for (const item of allItems) {
    const pid = item.project_id as string;
    const qty = safeNum(item.quantity);
    projectCostMap.set(pid, (projectCostMap.get(pid) ?? 0) + safeNum(item.cost_price) * qty);
    projectSellingMap.set(pid, (projectSellingMap.get(pid) ?? 0) + safeNum(item.selling_price) * qty);
  }

  // 顧客ごとに集計
  const customerMap = new Map<string, { customer_name: string; total_sales: number; total_cost: number; project_count: number }>();
  for (const p of allProjects) {
    const pid = p.id as string;
    const sales = projectInvoiceMap.get(pid);
    if (sales === undefined) continue; // 期間外
    const custId = p.customer_id as string;
    const existing = customerMap.get(custId) ?? {
      customer_name: p.customer_name as string,
      total_sales: 0,
      total_cost: 0,
      project_count: 0,
    };
    existing.total_sales += sales;
    existing.total_cost += projectCostMap.get(pid) ?? 0;
    existing.project_count += 1;
    customerMap.set(custId, existing);
  }

  return Array.from(customerMap.entries())
    .map(([customer_id, v]) => {
      const profit = v.total_sales - v.total_cost;
      return {
        customer_id,
        customer_name: v.customer_name,
        total_sales: v.total_sales,
        total_cost: v.total_cost,
        total_profit: profit,
        project_count: v.project_count,
        margin_rate: v.total_sales > 0 ? (profit / v.total_sales) * 100 : 0,
      };
    })
    .sort((a, b) => b.total_sales - a.total_sales);
}

// ============================================================
// Year-over-Year Monthly Data
// ============================================================

export async function sbGetYoYData(year: number): Promise<YoYMonthlyPoint[]> {
  const sb = supabase();
  const { data: invoices } = await sb.from("invoices").select("invoice_amount, billed_at");

  const allInvoices = (invoices ?? []) as Record<string, unknown>[];
  const currentYearMonthly = new Array(12).fill(0);
  const prevYearMonthly = new Array(12).fill(0);

  for (const inv of allInvoices) {
    const billedAt = inv.billed_at as string;
    if (!billedAt) continue;
    const d = new Date(billedAt);
    if (isNaN(d.getTime())) continue;
    const amount = safeNum(inv.invoice_amount);
    if (d.getFullYear() === year) {
      currentYearMonthly[d.getMonth()] += amount;
    } else if (d.getFullYear() === year - 1) {
      prevYearMonthly[d.getMonth()] += amount;
    }
  }

  return Array.from({ length: 12 }, (_, i) => {
    const curr = currentYearMonthly[i];
    const prev = prevYearMonthly[i];
    const diff = curr - prev;
    return {
      month: i + 1,
      current_year: curr,
      previous_year: prev,
      diff,
      diff_rate: prev > 0 ? (diff / prev) * 100 : 0,
    };
  });
}

// ============================================================
// Staff Performance
// ============================================================

export async function sbGetStaffPerformance(): Promise<StaffPerformance[]> {
  const orgId = await getOrgId();
  const sb = supabase();

  const [{ data: profiles }, { data: projects }, { data: projectItems }, { data: invoices }] = await Promise.all([
    sb.from("profiles").select("id, display_name").eq("org_id", orgId),
    sb.from("projects").select("id, assigned_staff_id"),
    sb.from("project_items").select("project_id, quantity, cost_price, selling_price"),
    sb.from("invoices").select("project_id, invoice_amount"),
  ]);

  const allProfiles = (profiles ?? []) as Record<string, unknown>[];
  const allProjects = (projects ?? []) as Record<string, unknown>[];
  const allItems = (projectItems ?? []) as Record<string, unknown>[];
  const allInvoices = (invoices ?? []) as Record<string, unknown>[];

  // プロジェクト別の売上・原価を集計
  const projectSales = new Map<string, number>();
  const projectCost = new Map<string, number>();
  for (const inv of allInvoices) {
    const pid = inv.project_id as string;
    projectSales.set(pid, (projectSales.get(pid) ?? 0) + safeNum(inv.invoice_amount));
  }
  for (const item of allItems) {
    const pid = item.project_id as string;
    const qty = safeNum(item.quantity);
    projectCost.set(pid, (projectCost.get(pid) ?? 0) + safeNum(item.cost_price) * qty);
  }

  // 担当者別に集計
  const staffMap = new Map<string, { project_count: number; total_sales: number; total_cost: number }>();
  for (const p of allProjects) {
    const staffId = p.assigned_staff_id as string | null;
    if (!staffId) continue;
    const pid = p.id as string;
    const existing = staffMap.get(staffId) ?? { project_count: 0, total_sales: 0, total_cost: 0 };
    existing.project_count += 1;
    existing.total_sales += projectSales.get(pid) ?? 0;
    existing.total_cost += projectCost.get(pid) ?? 0;
    staffMap.set(staffId, existing);
  }

  const profileMap = new Map<string, string>();
  for (const p of allProfiles) {
    profileMap.set(p.id as string, (p.display_name as string) || "未設定");
  }

  return Array.from(staffMap.entries())
    .map(([staff_id, v]) => {
      const profit = v.total_sales - v.total_cost;
      return {
        staff_id,
        display_name: profileMap.get(staff_id) ?? "不明",
        project_count: v.project_count,
        total_sales: v.total_sales,
        total_cost: v.total_cost,
        total_profit: profit,
        margin_rate: v.total_sales > 0 ? (profit / v.total_sales) * 100 : 0,
      };
    })
    .sort((a, b) => b.total_sales - a.total_sales);
}

// ============================================================
// Staff Monthly Targets
// ============================================================

export async function sbGetTargets(year: number): Promise<StaffMonthlyTarget[]> {
  const orgId = await getOrgId();
  const { data, error } = await supabase()
    .from("staff_monthly_targets")
    .select("id, staff_id, year, month, target_sales, target_profit, target_projects")
    .eq("org_id", orgId)
    .eq("year", year)
    .order("month");
  if (error) throw new Error("目標取得失敗: " + error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    staff_id: row.staff_id as string,
    year: safeNum(row.year),
    month: safeNum(row.month),
    target_sales: safeNum(row.target_sales),
    target_profit: safeNum(row.target_profit),
    target_projects: safeNum(row.target_projects),
  }));
}

export async function sbUpsertTarget(target: StaffMonthlyTarget): Promise<StaffMonthlyTarget> {
  const orgId = await getOrgId();
  const sb = supabase();

  // 既存レコードを検索
  const { data: existing } = await sb
    .from("staff_monthly_targets")
    .select("id")
    .eq("org_id", orgId)
    .eq("staff_id", target.staff_id)
    .eq("year", target.year)
    .eq("month", target.month)
    .maybeSingle();

  if (existing) {
    // UPDATE
    const { data, error } = await sb
      .from("staff_monthly_targets")
      .update({
        target_sales: safeNum(target.target_sales),
        target_profit: safeNum(target.target_profit),
        target_projects: safeNum(target.target_projects),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id, staff_id, year, month, target_sales, target_profit, target_projects")
      .single();
    if (error || !data) throw new Error("目標更新失敗: " + (error?.message ?? ""));
    return {
      id: data.id as string,
      staff_id: data.staff_id as string,
      year: safeNum(data.year),
      month: safeNum(data.month),
      target_sales: safeNum(data.target_sales),
      target_profit: safeNum(data.target_profit),
      target_projects: safeNum(data.target_projects),
    };
  } else {
    // INSERT
    const { data, error } = await sb
      .from("staff_monthly_targets")
      .insert({
        org_id: orgId,
        staff_id: target.staff_id,
        year: target.year,
        month: target.month,
        target_sales: safeNum(target.target_sales),
        target_profit: safeNum(target.target_profit),
        target_projects: safeNum(target.target_projects),
      })
      .select("id, staff_id, year, month, target_sales, target_profit, target_projects")
      .single();
    if (error || !data) throw new Error("目標登録失敗: " + (error?.message ?? ""));
    return {
      id: data.id as string,
      staff_id: data.staff_id as string,
      year: safeNum(data.year),
      month: safeNum(data.month),
      target_sales: safeNum(data.target_sales),
      target_profit: safeNum(data.target_profit),
      target_projects: safeNum(data.target_projects),
    };
  }
}

// ============================================================
// Target vs Actual
// ============================================================

export async function sbGetTargetVsActual(year: number, month?: number): Promise<StaffTargetVsActual[]> {
  const orgId = await getOrgId();
  const sb = supabase();

  // 目標を取得
  let targetQuery = sb
    .from("staff_monthly_targets")
    .select("staff_id, target_sales, target_profit, target_projects")
    .eq("org_id", orgId)
    .eq("year", year);
  if (month) targetQuery = targetQuery.eq("month", month);
  const { data: targets } = await targetQuery;

  // 担当者名を取得
  const { data: profiles } = await sb
    .from("profiles")
    .select("id, display_name")
    .eq("org_id", orgId);

  // 実績データを取得
  const [{ data: projects }, { data: projectItems }, { data: invoices }] = await Promise.all([
    sb.from("projects").select("id, assigned_staff_id"),
    sb.from("project_items").select("project_id, quantity, cost_price, selling_price"),
    sb.from("invoices").select("project_id, invoice_amount, billed_at"),
  ]);

  const allProjects = (projects ?? []) as Record<string, unknown>[];
  const allItems = (projectItems ?? []) as Record<string, unknown>[];
  const allInvoices = (invoices ?? []) as Record<string, unknown>[];

  // 期間内の請求からプロジェクト別売上
  const projectSales = new Map<string, number>();
  for (const inv of allInvoices) {
    const billedAt = inv.billed_at as string;
    if (!billedAt) continue;
    const d = new Date(billedAt);
    if (d.getFullYear() !== year) continue;
    if (month && d.getMonth() + 1 !== month) continue;
    const pid = inv.project_id as string;
    projectSales.set(pid, (projectSales.get(pid) ?? 0) + safeNum(inv.invoice_amount));
  }

  // プロジェクト別原価
  const projectCost = new Map<string, number>();
  for (const item of allItems) {
    const pid = item.project_id as string;
    const qty = safeNum(item.quantity);
    projectCost.set(pid, (projectCost.get(pid) ?? 0) + safeNum(item.cost_price) * qty);
  }

  // 担当者別実績
  const staffActual = new Map<string, { sales: number; cost: number; projects: number }>();
  for (const p of allProjects) {
    const staffId = p.assigned_staff_id as string | null;
    if (!staffId) continue;
    const pid = p.id as string;
    const sales = projectSales.get(pid);
    if (sales === undefined) continue;
    const existing = staffActual.get(staffId) ?? { sales: 0, cost: 0, projects: 0 };
    existing.sales += sales;
    existing.cost += projectCost.get(pid) ?? 0;
    existing.projects += 1;
    staffActual.set(staffId, existing);
  }

  // 目標を担当者別に合算
  const staffTargets = new Map<string, { sales: number; profit: number; projects: number }>();
  for (const t of (targets ?? []) as Record<string, unknown>[]) {
    const staffId = t.staff_id as string;
    const existing = staffTargets.get(staffId) ?? { sales: 0, profit: 0, projects: 0 };
    existing.sales += safeNum(t.target_sales);
    existing.profit += safeNum(t.target_profit);
    existing.projects += safeNum(t.target_projects);
    staffTargets.set(staffId, existing);
  }

  const profileMap = new Map<string, string>();
  for (const p of (profiles ?? []) as Record<string, unknown>[]) {
    profileMap.set(p.id as string, (p.display_name as string) || "未設定");
  }

  // 全スタッフIDをマージ
  const allStaffIds = new Set([...staffTargets.keys(), ...staffActual.keys()]);

  return Array.from(allStaffIds)
    .map((staff_id) => {
      const target = staffTargets.get(staff_id) ?? { sales: 0, profit: 0, projects: 0 };
      const actual = staffActual.get(staff_id) ?? { sales: 0, cost: 0, projects: 0 };
      const actualProfit = actual.sales - actual.cost;
      return {
        staff_id,
        display_name: profileMap.get(staff_id) ?? "不明",
        target_sales: target.sales,
        target_profit: target.profit,
        target_projects: target.projects,
        actual_sales: actual.sales,
        actual_profit: actualProfit,
        actual_projects: actual.projects,
        achievement_rate: target.sales > 0 ? (actual.sales / target.sales) * 100 : 0,
      };
    })
    .sort((a, b) => b.actual_sales - a.actual_sales);
}

// ============================================================
// Project Staff Assignment
// ============================================================

export async function sbUpdateProjectStaff(projectId: string, staffId: string | null): Promise<Project> {
  const { data, error } = await supabase()
    .from("projects")
    .update({ assigned_staff_id: staffId })
    .eq("id", projectId)
    .select()
    .single();
  if (error || !data) throw new Error("担当者更新失敗: " + (error?.message ?? ""));
  return toProject(data);
}

// ============================================================
// Collection Metrics (入金管理指標)
// ============================================================

export async function sbGetCollectionMetrics(): Promise<CollectionMetrics> {
  const orgId = await getOrgId();
  const { data: invoices, error } = await supabase()
    .from("invoices")
    .select("*")
    .eq("org_id", orgId);
  if (error) throw new Error("入金指標取得失敗");

  const rows = invoices ?? [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalBilled = 0;
  let totalPaid = 0;
  let totalReceivable = 0;
  let totalOverdue = 0;
  let overdueCount = 0;
  const buckets: Record<string, { count: number; total: number }> = {
    "正常": { count: 0, total: 0 },
    "30日超過": { count: 0, total: 0 },
    "60日超過": { count: 0, total: 0 },
    "90日超過": { count: 0, total: 0 },
  };

  for (const inv of rows) {
    const amount = safeNum(inv.invoice_amount);
    const paid = safeNum(inv.paid_amount);
    const remaining = safeNum(inv.remaining_amount);
    totalBilled += amount;
    totalPaid += paid;

    if (remaining <= 0) continue; // 入金済みはスキップ
    totalReceivable += remaining;

    const due = new Date(inv.due_date);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      buckets["正常"].count++;
      buckets["正常"].total += remaining;
    } else if (diffDays <= 30) {
      buckets["30日超過"].count++;
      buckets["30日超過"].total += remaining;
      totalOverdue += remaining;
      overdueCount++;
    } else if (diffDays <= 60) {
      buckets["60日超過"].count++;
      buckets["60日超過"].total += remaining;
      totalOverdue += remaining;
      overdueCount++;
    } else {
      buckets["90日超過"].count++;
      buckets["90日超過"].total += remaining;
      totalOverdue += remaining;
      overdueCount++;
    }
  }

  // DSO = 売掛残高 / (年間売上 / 365)
  const dso = totalBilled > 0 ? Math.round((totalReceivable / totalBilled) * 365) : 0;
  // 回収率 = 入金済 / 請求済 * 100
  const collectionRate = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 1000) / 10 : 100;

  return {
    dso,
    collection_rate: collectionRate,
    total_receivable: totalReceivable,
    total_overdue: totalOverdue,
    overdue_count: overdueCount,
    aging_buckets: Object.entries(buckets).map(([label, v]) => ({
      label,
      count: v.count,
      total_amount: v.total,
    })),
  };
}

// ============================================================
// Unpaid Invoices (未入金一覧)
// ============================================================

export async function sbGetUnpaidInvoices(): Promise<UnpaidInvoice[]> {
  const orgId = await getOrgId();

  // invoicesを取得
  const { data: invoices, error } = await supabase()
    .from("invoices")
    .select("*")
    .eq("org_id", orgId)
    .gt("remaining_amount", 0)
    .order("due_date", { ascending: true });
  if (error) throw new Error("未入金一覧取得失敗");

  if (!invoices || invoices.length === 0) return [];

  // project_idsを収集
  const projectIds = [...new Set(invoices.map(i => i.project_id))];

  // projectsを取得
  const { data: projects } = await supabase()
    .from("projects")
    .select("id, project_name, customer_name, customer_id")
    .in("id", projectIds);

  const projectMap = new Map((projects ?? []).map(p => [p.id, p]));

  // customer_idsを収集してcustomersを取得
  const customerIds = [...new Set((projects ?? []).map(p => p.customer_id).filter(Boolean))];
  let customerMap = new Map<string, { email?: string }>();
  if (customerIds.length > 0) {
    const { data: customers } = await supabase()
      .from("customers")
      .select("id, email")
      .in("id", customerIds);
    customerMap = new Map((customers ?? []).map(c => [c.id, { email: c.email }]));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return invoices.map(inv => {
    const proj = projectMap.get(inv.project_id);
    const cust = proj?.customer_id ? customerMap.get(proj.customer_id) : undefined;
    const due = new Date(inv.due_date);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    const daysOverdue = Math.max(0, diffDays);

    let aging = "正常";
    if (diffDays > 90) aging = "90日超過";
    else if (diffDays > 60) aging = "60日超過";
    else if (diffDays > 30) aging = "30日超過";
    else if (diffDays > 0) aging = "30日超過";

    return {
      invoice_id: inv.id,
      project_id: inv.project_id,
      project_name: proj?.project_name ?? "不明",
      customer_name: proj?.customer_name ?? "不明",
      customer_email: cust?.email ?? null,
      invoice_amount: safeNum(inv.invoice_amount),
      remaining_amount: safeNum(inv.remaining_amount),
      due_date: inv.due_date,
      days_overdue: daysOverdue,
      aging_category: aging,
    };
  });
}

// ============================================================
// Upcoming Payment Reminders (入金リマインダー)
// ============================================================

export async function sbGetUpcomingPaymentReminders(daysAhead: number = 3): Promise<UnpaidInvoice[]> {
  const all = await sbGetUnpaidInvoices();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(today);
  target.setDate(target.getDate() + daysAhead);

  return all.filter(inv => {
    if (!inv.customer_email) return false;
    const due = new Date(inv.due_date);
    due.setHours(0, 0, 0, 0);
    // 期日がtoday〜target日後の範囲内
    return due >= today && due <= target;
  });
}

// ============================================================
// Project A: 検索・集計・エクスポート
// ============================================================

export async function sbGetCustomerDetail(customerId: string): Promise<import("./types").CustomerDetail> {
  const sb = supabase();
  const orgId = await getOrgId();

  const [custRes, projRes, itemsRes, invRes] = await Promise.all([
    sb.from("customers").select("*").eq("org_id", orgId).eq("id", customerId).single(),
    sb.from("projects").select("*").eq("org_id", orgId).eq("customer_id", customerId).order("created_at", { ascending: false }),
    sb.from("project_items").select("*").eq("org_id", orgId),
    sb.from("invoices").select("*").eq("org_id", orgId),
  ]);

  if (!custRes.data) throw new Error("顧客が見つかりません");

  const projects = (projRes.data ?? []).map(toProject);
  const projectIds = new Set(projects.map((p) => p.project_id));

  // プロジェクト別の原価・売値
  const costMap = new Map<string, number>();
  const sellingMap = new Map<string, number>();
  for (const row of itemsRes.data ?? []) {
    const pid = row.project_id as string;
    if (!projectIds.has(pid)) continue;
    const qty = safeNum(row.quantity);
    costMap.set(pid, (costMap.get(pid) ?? 0) + safeNum(row.cost_price) * qty);
    sellingMap.set(pid, (sellingMap.get(pid) ?? 0) + safeNum(row.selling_price) * qty);
  }

  // 月次売上（請求ベース）
  const monthlyMap = new Map<string, number>();
  let totalSales = 0;
  for (const row of invRes.data ?? []) {
    const pid = row.project_id as string;
    if (!projectIds.has(pid)) continue;
    const amt = safeNum(row.invoice_amount);
    totalSales += amt;
    const billedAt = row.billed_at as string | null;
    if (billedAt) {
      const key = billedAt.slice(0, 7);
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + amt);
    }
  }

  let totalCost = 0;
  for (const pid of projectIds) {
    totalCost += costMap.get(pid) ?? 0;
  }
  const totalProfit = totalSales - totalCost;

  const monthly_sales = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount }));

  return {
    customer: toCustomer(custRes.data),
    projects,
    total_sales: totalSales,
    total_cost: totalCost,
    total_profit: totalProfit,
    margin_rate: totalSales > 0 ? (totalProfit / totalSales) * 100 : 0,
    project_count: projects.length,
    monthly_sales,
  };
}

export async function sbGetInvoicesWithProjects(
  period?: { from?: string; to?: string },
): Promise<import("./types").InvoiceWithProject[]> {
  const sb = supabase();
  const orgId = await getOrgId();

  const [invRes, projRes] = await Promise.all([
    sb.from("invoices").select("*").eq("org_id", orgId).order("billed_at", { ascending: false }),
    sb.from("projects").select("id, project_name, customer_name").eq("org_id", orgId),
  ]);

  const projMap = new Map(
    (projRes.data ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
  );

  let result = (invRes.data ?? []).map((row: Record<string, unknown>) => {
    const proj = projMap.get(row.project_id as string);
    return {
      ...toInvoice(row),
      project_name: (proj?.project_name as string) ?? "不明",
      customer_name: (proj?.customer_name as string) ?? "不明",
    };
  });

  if (period?.from) result = result.filter((inv) => inv.billed_at >= period.from!);
  if (period?.to) result = result.filter((inv) => inv.billed_at <= period.to!);

  return result;
}

export async function sbGetPaymentsWithProjects(
  period?: { from?: string; to?: string },
): Promise<import("./types").PaymentWithProject[]> {
  const sb = supabase();
  const orgId = await getOrgId();

  const [payRes, projRes] = await Promise.all([
    sb.from("payments").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
    sb.from("projects").select("id, project_name").eq("org_id", orgId),
  ]);

  const projMap = new Map(
    (projRes.data ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
  );

  let result = (payRes.data ?? []).map((row: Record<string, unknown>) => {
    const proj = projMap.get(row.project_id as string);
    return {
      ...toPayment(row),
      project_name: (proj?.project_name as string) ?? "不明",
    };
  });

  if (period?.from) result = result.filter((p) => (p.paid_at ?? p.status) >= period.from!);
  if (period?.to) result = result.filter((p) => (p.paid_at ?? "") <= period.to!);

  return result;
}

// ============================================================
// Phase 2: 銀行融資指標（Bank Dashboard）
// ============================================================

export async function sbGetBankDashboard(): Promise<BankDashboardData> {
  const sb = supabase();

  const [
    { data: invoices },
    { data: payments },
    { data: projectItems },
    { data: projects },
  ] = await Promise.all([
    sb.from("invoices").select("*"),
    sb.from("payments").select("*"),
    sb.from("project_items").select("project_id, quantity, cost_price, selling_price"),
    sb.from("projects").select("id, created_at"),
  ]);

  const allInvoices = (invoices ?? []) as Record<string, unknown>[];
  const allPayments = (payments ?? []) as Record<string, unknown>[];
  const allItems = (projectItems ?? []) as Record<string, unknown>[];
  const allProjects = (projects ?? []) as Record<string, unknown>[];

  const today = new Date();

  // --- 月次売上・原価の集計（過去12ヶ月） ---
  const monthlyData = new Map<string, { sales: number; cost: number; invoiceCount: number; collectionAmt: number }>();

  // 12ヶ月分の枠を作る
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyData.set(key, { sales: 0, cost: 0, invoiceCount: 0, collectionAmt: 0 });
  }

  // プロジェクト別原価マップ
  const projectCostMap = new Map<string, number>();
  for (const item of allItems) {
    const pid = item.project_id as string;
    const cost = safeNum(item.cost_price) * safeNum(item.quantity);
    projectCostMap.set(pid, (projectCostMap.get(pid) ?? 0) + cost);
  }

  // プロジェクト作成月マップ
  const projectMonthMap = new Map<string, string>();
  for (const p of allProjects) {
    const created = p.created_at as string;
    if (created) {
      projectMonthMap.set(p.id as string, created.slice(0, 7));
    }
  }

  // 請求データから月次売上を集計
  for (const inv of allInvoices) {
    const billedAt = inv.billed_at as string;
    if (!billedAt) continue;
    const monthKey = billedAt.slice(0, 7);
    const entry = monthlyData.get(monthKey);
    if (!entry) continue;
    entry.sales += safeNum(inv.invoice_amount);
    entry.invoiceCount += 1;
    entry.collectionAmt += safeNum(inv.paid_amount);
  }

  // 月ごとの原価をプロジェクト作成月で振り分け
  for (const [pid, cost] of projectCostMap.entries()) {
    const month = projectMonthMap.get(pid);
    if (!month) continue;
    const entry = monthlyData.get(month);
    if (entry) entry.cost += cost;
  }

  // --- 月次粗利率トレンド ---
  const monthly_margin_trend: MonthlyMarginTrend[] = [];
  for (const [month, data] of monthlyData.entries()) {
    const grossProfit = data.sales - data.cost;
    const rate = data.sales > 0 ? (grossProfit / data.sales) * 100 : 0;
    monthly_margin_trend.push({
      month,
      sales: data.sales,
      cost: data.cost,
      gross_profit: grossProfit,
      gross_margin_rate: Math.round(rate * 10) / 10,
    });
  }

  // --- キャッシュポジション推移 ---
  // 各月末時点での売掛・買掛残高を推計
  const monthKeys = Array.from(monthlyData.keys());
  const cash_position_trend: CashPositionPoint[] = [];

  // 累積的に計算
  let cumulativeReceivable = 0;
  let cumulativePayable = 0;

  for (const month of monthKeys) {
    const data = monthlyData.get(month)!;
    // 売掛 = 売上 - 回収
    cumulativeReceivable += data.sales - data.collectionAmt;
    // 買掛 = 原価 - 支払（簡易推計: 原価の一定割合が月内支払と仮定）
    const monthPayments = allPayments
      .filter((p) => {
        const paidAt = p.paid_at as string | null;
        return paidAt && paidAt.slice(0, 7) === month;
      })
      .reduce((s, p) => s + safeNum(p.paid_amount), 0);
    cumulativePayable += data.cost - monthPayments;

    cash_position_trend.push({
      month,
      receivable: Math.max(cumulativeReceivable, 0),
      payable: Math.max(cumulativePayable, 0),
      cash_position: cumulativeReceivable - cumulativePayable,
    });
  }

  // --- DSO（売上債権回収日数）---
  const totalReceivable = allInvoices.reduce((s, x) => s + safeNum(x.remaining_amount), 0);
  const totalAnnualSales = allInvoices.reduce((s, x) => s + safeNum(x.invoice_amount), 0);
  const dso = totalAnnualSales > 0 ? Math.round((totalReceivable / totalAnnualSales) * 365) : 0;

  // DSO推移（月次）
  const dso_trend: { month: string; dso: number }[] = [];
  let runningReceivable = 0;
  let runningSales = 0;
  for (const month of monthKeys) {
    const data = monthlyData.get(month)!;
    runningSales += data.sales;
    runningReceivable += data.sales - data.collectionAmt;
    const monthDso = runningSales > 0 ? Math.round((Math.max(runningReceivable, 0) / runningSales) * 365) : 0;
    dso_trend.push({ month, dso: monthDso });
  }

  // --- その他の指標 ---
  const totalPayable = allPayments.reduce((s, x) => s + safeNum(x.remaining_amount), 0);
  const current_ratio = totalPayable > 0 ? Math.round((totalReceivable / totalPayable) * 100) / 100 : 0;

  // 平均回収日数（入金済み請求の billed_at → 支払い完了日までの日数）
  let totalCollectionDays = 0;
  let collectedCount = 0;
  for (const inv of allInvoices) {
    const paid = safeNum(inv.paid_amount);
    const amount = safeNum(inv.invoice_amount);
    if (paid >= amount && amount > 0) {
      const billed = new Date(inv.billed_at as string);
      const due = new Date(inv.due_date as string);
      const days = Math.max(0, Math.floor((due.getTime() - billed.getTime()) / (1000 * 60 * 60 * 24)));
      totalCollectionDays += days;
      collectedCount++;
    }
  }
  const avg_collection_days = collectedCount > 0 ? Math.round(totalCollectionDays / collectedCount) : 30;

  // 平均支払日数
  let totalPaymentDays = 0;
  let paidCount = 0;
  for (const pay of allPayments) {
    const paidAt = pay.paid_at as string | null;
    const createdAt = pay.created_at as string | null;
    if (paidAt && createdAt) {
      const created = new Date(createdAt);
      const paid = new Date(paidAt);
      const days = Math.max(0, Math.floor((paid.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
      totalPaymentDays += days;
      paidCount++;
    }
  }
  const avg_payment_days = paidCount > 0 ? Math.round(totalPaymentDays / paidCount) : 30;

  return {
    monthly_margin_trend,
    cash_position_trend,
    dso,
    dso_trend,
    current_ratio,
    avg_collection_days,
    avg_payment_days,
    working_capital: totalReceivable - totalPayable,
  };
}

// ============================================================
// Phase 2: ダッシュボード高速化版
// projects テーブルの集計カラムを使用（トリガーで自動更新済み）
// ============================================================

export async function sbGetDashboardOverviewV2(): Promise<DashboardOverview> {
  const sb = supabase();

  const [
    { data: projects },
    { data: invoices },
    { data: payments },
  ] = await Promise.all([
    sb.from("projects").select("id, customer_name, project_name, project_status, created_at, total_cost, total_selling, margin, margin_rate"),
    sb.from("invoices").select("invoice_amount, paid_amount, remaining_amount, billed_at"),
    sb.from("payments").select("ordered_amount, paid_amount, remaining_amount, vendor_name"),
  ]);

  const allProjects = (projects ?? []) as Record<string, unknown>[];
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

  // projects の集計カラムを直接使用（メモリ集計不要）
  let all_time_cost = 0;
  let all_time_selling = 0;
  let next_month_projection = 0;
  let pipeline_total = 0;
  let pipeline_count = 0;
  const statusCounts: Record<string, number> = {};

  for (const p of allProjects) {
    const status = p.project_status as string;
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    const selling = safeNum(p.total_selling);
    const cost = safeNum(p.total_cost);
    all_time_selling += selling;
    all_time_cost += cost;
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
    .map((p) => ({
      project_id: p.id as string,
      project_name: p.project_name as string,
      customer_name: p.customer_name as string,
      project_status: p.project_status as string,
      selling_total: safeNum(p.total_selling),
      cost_total: safeNum(p.total_cost),
      margin: safeNum(p.margin),
      margin_rate: safeNum(p.margin_rate),
      created_at: (p.created_at as string).slice(0, 10),
    }));

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
