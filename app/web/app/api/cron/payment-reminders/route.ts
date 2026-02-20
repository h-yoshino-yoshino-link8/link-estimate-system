import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Vercel Cron認証
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL || "noreply@example.com";

  if (!supabaseUrl || !serviceKey || !resendKey) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const resend = new Resend(resendKey);

  // 3日後の日付
  const today = new Date();
  const threeDaysLater = new Date(today);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);
  const todayStr = today.toISOString().split("T")[0];
  const targetStr = threeDaysLater.toISOString().split("T")[0];

  // 入金期日が今日〜3日後の未入金請求を取得
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, invoice_amount, remaining_amount, due_date, project_id")
    .gt("remaining_amount", 0)
    .gte("due_date", todayStr)
    .lte("due_date", targetStr);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!invoices || invoices.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No upcoming invoices" });
  }

  // project_idsを収集してprojects + customersを取得
  const projectIds = [...new Set(invoices.map((i: { project_id: string }) => i.project_id))];
  const { data: projects } = await supabase
    .from("projects")
    .select("id, project_name, customer_name, customer_id")
    .in("id", projectIds);

  const projectMap = new Map((projects ?? []).map((p: { id: string; project_name: string; customer_name: string; customer_id?: string }) => [p.id, p]));

  // customer emailを取得
  const customerIds = [...new Set((projects ?? []).map((p: { customer_id?: string }) => p.customer_id).filter(Boolean))];
  let customerEmailMap = new Map<string, string>();
  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from("customers")
      .select("id, email, customer_name")
      .in("id", customerIds);
    customerEmailMap = new Map(
      (customers ?? [])
        .filter((c: { email?: string }) => c.email)
        .map((c: { id: string; email: string }) => [c.id, c.email])
    );
  }

  // 送信元会社名を取得
  const { data: orgs } = await supabase
    .from("organizations")
    .select("name")
    .limit(1);
  const companyName = orgs?.[0]?.name || "株式会社LinK";

  let sent = 0;
  const errors: string[] = [];

  for (const inv of invoices) {
    const proj = projectMap.get(inv.project_id);
    if (!proj?.customer_id) continue;
    const email = customerEmailMap.get(proj.customer_id);
    if (!email) continue;

    try {
      await resend.emails.send({
        from: `${companyName} <${senderEmail}>`,
        to: email,
        subject: `【ご入金予定のお知らせ】${proj.project_name}`,
        html: `
          <p>${proj.customer_name} 様</p>
          <p>いつもお世話になっております。${companyName}です。</p>
          <p>下記のご入金予定日が近づいておりますので、ご確認のほどよろしくお願いいたします。</p>
          <table style="border-collapse:collapse;margin:1rem 0;">
            <tr><td style="padding:4px 12px;font-weight:bold;">案件名</td><td style="padding:4px 12px;">${proj.project_name}</td></tr>
            <tr><td style="padding:4px 12px;font-weight:bold;">ご入金予定額</td><td style="padding:4px 12px;">&yen;${Number(inv.remaining_amount).toLocaleString()}</td></tr>
            <tr><td style="padding:4px 12px;font-weight:bold;">ご入金予定日</td><td style="padding:4px 12px;">${inv.due_date}</td></tr>
          </table>
          <p>行き違いの場合はご容赦ください。</p>
          <p>何かご不明点がございましたらお気軽にご連絡ください。</p>
          <p style="margin-top:2rem;color:#64748b;font-size:0.875rem;">
            ${companyName}
          </p>
        `,
      });
      sent++;
    } catch (e) {
      errors.push(`Failed to send to ${email}: ${e}`);
    }
  }

  return NextResponse.json({ ok: true, sent, total: invoices.length, errors });
}
