// ============================================================
// LinK Estimate OS — Admin Operations (Project B)
// ============================================================

import { createClient } from "../supabase/client";
import { getOrgId } from "./supabase-ops";
import type { TableStat, UserProfile, EmailLog } from "./types";

function supabase() { return createClient(); }

const TABLE_DEFS: { name: string; display: string; desc: string }[] = [
  { name: "customers", display: "顧客", desc: "顧客マスタ" },
  { name: "vendors", display: "仕入先", desc: "仕入先マスタ" },
  { name: "work_items", display: "単価表", desc: "工事単価マスタ" },
  { name: "projects", display: "案件", desc: "見積・施工案件" },
  { name: "project_items", display: "明細", desc: "案件の工事明細" },
  { name: "invoices", display: "請求", desc: "請求書" },
  { name: "payments", display: "支払", desc: "発注・支払" },
  { name: "organizations", display: "組織", desc: "会社情報" },
  { name: "profiles", display: "ユーザー", desc: "スタッフ" },
  { name: "staff_monthly_targets", display: "目標", desc: "月次目標" },
  { name: "email_logs", display: "メールログ", desc: "送信履歴" },
];

export async function sbGetSystemStatus(): Promise<TableStat[]> {
  const sb = supabase();
  const results = await Promise.all(
    TABLE_DEFS.map(async (def) => {
      const { count } = await sb
        .from(def.name)
        .select("*", { count: "exact", head: true });
      return {
        table_name: def.name,
        display_name: def.display,
        count: count ?? 0,
        description: def.desc,
      };
    }),
  );
  return results;
}

export async function sbGetUserProfiles(): Promise<UserProfile[]> {
  const orgId = await getOrgId();
  const { data, error } = await supabase()
    .from("profiles")
    .select("id, display_name, role")
    .eq("org_id", orgId)
    .order("display_name");
  if (error) throw new Error("ユーザー一覧取得失敗: " + error.message);
  return (data ?? []) as UserProfile[];
}

export async function sbUpdateUserRole(userId: string, role: string): Promise<UserProfile> {
  const { data, error } = await supabase()
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select("id, display_name, role")
    .single();
  if (error || !data) throw new Error("ロール更新失敗: " + (error?.message ?? ""));
  return data as UserProfile;
}

export async function sbGetEmailLogs(limit: number = 50): Promise<EmailLog[]> {
  const orgId = await getOrgId();
  const { data, error } = await supabase()
    .from("email_logs")
    .select("id, to_email, subject, status, error_message, sent_at")
    .eq("org_id", orgId)
    .order("sent_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("メールログ取得失敗: " + error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    to_email: row.to_email as string,
    subject: row.subject as string,
    status: row.status as string,
    error_message: row.error_message as string | null | undefined,
    sent_at: String(row.sent_at),
  }));
}

export async function sbCreateEmailLog(payload: {
  org_id: string;
  to_email: string;
  subject: string;
  status: string;
  error_message?: string;
}): Promise<void> {
  try {
    await supabase().from("email_logs").insert(payload);
  } catch {
    // ログ書き込み失敗でメイン処理を止めない
  }
}
