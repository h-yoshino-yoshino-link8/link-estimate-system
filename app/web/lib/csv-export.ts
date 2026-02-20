"use client";

import type { Project, Invoice, Payment } from "./api/types";

function escapeCSV(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSVString(headers: string[], rows: string[][]): string {
  const BOM = "\uFEFF";
  const headerLine = headers.map(escapeCSV).join(",");
  const dataLines = rows.map((row) => row.map(escapeCSV).join(","));
  return BOM + [headerLine, ...dataLines].join("\n");
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportProjectsCSV(projects: Project[], filename?: string) {
  const headers = ["案件名", "顧客名", "現場住所", "ステータス", "担当者", "作成日"];
  const rows = projects.map((p) => [
    p.project_name,
    p.customer_name,
    p.site_address ?? "",
    p.project_status,
    p.owner_name,
    p.created_at,
  ]);
  const csv = toCSVString(headers, rows);
  downloadCSV(csv, filename ?? `案件一覧_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportInvoicesCSV(
  invoices: (Invoice & { project_name?: string; customer_name?: string })[],
  filename?: string,
) {
  const headers = ["案件名", "顧客名", "請求額", "入金済", "残額", "請求日", "支払期限", "ステータス"];
  const rows = invoices.map((inv) => [
    (inv as Record<string, unknown>).project_name as string ?? "",
    (inv as Record<string, unknown>).customer_name as string ?? "",
    String(inv.invoice_amount),
    String(inv.paid_amount),
    String(inv.remaining_amount),
    inv.billed_at,
    inv.due_date,
    inv.status,
  ]);
  const csv = toCSVString(headers, rows);
  downloadCSV(csv, filename ?? `請求一覧_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportPaymentsCSV(
  payments: (Payment & { project_name?: string })[],
  filename?: string,
) {
  const headers = ["案件名", "仕入先", "工事内容", "発注額", "支払済", "残額", "ステータス"];
  const rows = payments.map((pay) => [
    (pay as Record<string, unknown>).project_name as string ?? "",
    pay.vendor_name,
    pay.work_description ?? "",
    String(pay.ordered_amount),
    String(pay.paid_amount),
    String(pay.remaining_amount),
    pay.status,
  ]);
  const csv = toCSVString(headers, rows);
  downloadCSV(csv, filename ?? `支払一覧_${new Date().toISOString().slice(0, 10)}.csv`);
}
