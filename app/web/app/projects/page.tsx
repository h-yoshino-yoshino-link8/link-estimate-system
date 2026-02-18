"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import {
  getProjects, getCustomers, createProject,
  PROJECT_STATUSES,
  type Project, type Customer,
} from "../../lib/api";

function statusBadgeClass(status: string) {
  if (status === "見積中") return "badge badge-default";
  if (status === "受注") return "badge badge-blue";
  if (status === "施工中") return "badge badge-warning";
  if (status === "完了" || status === "請求済") return "badge badge-success";
  if (status === "入金済") return "badge badge-success";
  if (status === "失注") return "badge badge-error";
  return "badge badge-default";
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // New project form
  const [formOpen, setFormOpen] = useState(false);
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [projData, custData] = await Promise.all([getProjects(), getCustomers()]);
      setProjects(projData.items);
      setCustomers(custData);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "データ取得失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: projects.length };
    for (const p of projects) {
      counts[p.project_status] = (counts[p.project_status] ?? 0) + 1;
    }
    return counts;
  }, [projects]);

  // Filtered projects
  const filtered = useMemo(() => {
    let list = [...projects];
    if (statusFilter !== "all") {
      list = list.filter((p) => p.project_status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.project_id.toLowerCase().includes(q) ||
        p.project_name.toLowerCase().includes(q) ||
        p.customer_name.toLowerCase().includes(q) ||
        (p.site_address ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [projects, statusFilter, search]);

  const handleCreate = async () => {
    if (!newCustomerId || !newName.trim()) {
      setMessage("顧客と案件名は必須です");
      return;
    }
    setCreating(true);
    setMessage("");
    try {
      await createProject({
        customer_id: newCustomerId,
        project_name: newName.trim(),
        site_address: newAddress.trim() || undefined,
      });
      setNewName("");
      setNewAddress("");
      setFormOpen(false);
      await load();
      setMessage("案件を作成しました");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "作成失敗");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>案件管理</h1>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--c-text-3)" }}>
            全{projects.length}件
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--sp-2)" }}>
          <button className="btn btn-primary" onClick={() => setFormOpen(!formOpen)}>
            {formOpen ? "閉じる" : "新規案件"}
          </button>
          <button className="btn" onClick={() => void load()} disabled={loading}>更新</button>
        </div>
      </div>

      {/* New project form */}
      {formOpen && (
        <div className="card">
          <div className="card-title">新規案件作成</div>
          <div className="form-grid">
            <div className="form-row">
              <label>
                顧客
                <select value={newCustomerId} onChange={(e) => setNewCustomerId(e.target.value)}>
                  <option value="">選択してください</option>
                  {customers.map((c) => (
                    <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>
                  ))}
                </select>
              </label>
              <label>
                案件名
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="例: 練馬区桜台 2F 原状回復" />
              </label>
            </div>
            <label>
              現場住所
              <input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="東京都..." />
            </label>
            <div>
              <button className="btn btn-primary" onClick={() => void handleCreate()} disabled={creating}>
                {creating ? "作成中..." : "案件を作成"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status pipeline filter */}
      <div className="status-pipeline">
        <button
          className={`status-chip ${statusFilter === "all" ? "is-active" : ""}`}
          onClick={() => setStatusFilter("all")}
        >
          すべて<span className="chip-count">{statusCounts.all ?? 0}</span>
        </button>
        {PROJECT_STATUSES.map((s) => (
          <button
            key={s}
            className={`status-chip ${statusFilter === s ? "is-active" : ""}`}
            onClick={() => setStatusFilter(s)}
          >
            {s}<span className="chip-count">{statusCounts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="案件ID、案件名、顧客名、住所で検索..."
        style={{ maxWidth: 400 }}
      />

      {/* Projects table */}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>案件名</th>
              <th>顧客</th>
              <th>現場</th>
              <th>ステータス</th>
              <th>作成日</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={7}>
                  {loading ? "読み込み中..." : "該当する案件がありません"}
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.project_id}>
                  <td><span className="text-mono">{p.project_id}</span></td>
                  <td style={{ fontWeight: 500 }}>{p.project_name}</td>
                  <td>{p.customer_name}</td>
                  <td style={{ fontSize: 12, color: "var(--c-text-3)" }}>{p.site_address ?? "-"}</td>
                  <td><span className={statusBadgeClass(p.project_status)}>{p.project_status}</span></td>
                  <td style={{ fontSize: 12 }}>{p.created_at}</td>
                  <td>
                    <Link href={`/projects/${p.project_id}`} className="btn btn-sm" style={{ textDecoration: "none" }}>
                      開く
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {message && (
        <p className={`message ${message.includes("失敗") || message.includes("必須") ? "message-error" : "message-success"}`}>
          {message}
        </p>
      )}
    </main>
  );
}
