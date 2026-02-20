"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import {
  getProjects, createProjectQuick,
  getCustomers, getStaffMembers,
  PROJECT_STATUSES,
  type Project, type Customer, type StaffMember,
} from "../../lib/api";
import { exportProjectsCSV } from "../../lib/csv-export";

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
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [customerFilter, setCustomerFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);

  // Quick create - 案件名1つだけ
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Detail fields (optional, hidden by default)
  const [customerName, setCustomerName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [projData, custData, staffData] = await Promise.all([
        getProjects(),
        getCustomers(),
        getStaffMembers(),
      ]);
      setProjects(projData.items);
      setCustomers(custData);
      setStaffMembers(staffData);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "データ取得失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: projects.length };
    for (const p of projects) {
      counts[p.project_status] = (counts[p.project_status] ?? 0) + 1;
    }
    return counts;
  }, [projects]);

  const filtered = useMemo(() => {
    let list = [...projects];
    if (statusFilter !== "all") {
      list = list.filter((p) => p.project_status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.project_name.toLowerCase().includes(q) ||
        p.customer_name.toLowerCase().includes(q) ||
        (p.site_address ?? "").toLowerCase().includes(q)
      );
    }
    if (customerFilter !== "all") {
      list = list.filter((p) => p.customer_id === customerFilter);
    }
    if (staffFilter !== "all") {
      list = list.filter((p) => p.assigned_staff_id === staffFilter);
    }
    if (dateFrom) {
      list = list.filter((p) => p.created_at >= dateFrom);
    }
    if (dateTo) {
      list = list.filter((p) => p.created_at <= dateTo + "T23:59:59");
    }
    return list;
  }, [projects, statusFilter, search, customerFilter, staffFilter, dateFrom, dateTo]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setMessage("案件名を入力してください");
      return;
    }
    setCreating(true);
    setMessage("");
    try {
      await createProjectQuick({
        customer_name: customerName.trim() || "未設定",
        project_name: name,
        site_address: siteAddress.trim() || undefined,
      });
      setNewName("");
      setCustomerName("");
      setSiteAddress("");
      setShowForm(false);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "作成失敗");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="page">
      <div className="page-header">
        <h1>案件管理</h1>
        <div style={{ display: "flex", gap: "var(--sp-2)" }}>
          <button className="btn" onClick={() => exportProjectsCSV(filtered)}>CSV出力</button>
          <button className="btn" onClick={() => void load()} disabled={loading}>更新</button>
        </div>
      </div>

      {/* 新規作成 - 大きいボタン + インライン入力 */}
      <div className="new-project-section">
        <div className="new-project-main">
          <input
            className="new-project-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="新しい案件名を入力（例: 桜台2F 原状回復）"
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
            autoFocus
          />
          <button
            className="btn btn-primary btn-lg"
            onClick={() => void handleCreate()}
            disabled={creating || !newName.trim()}
          >
            {creating ? "作成中..." : "+ 新規作成"}
          </button>
        </div>
        {newName.trim() && (
          <div className="new-project-detail">
            <button
              className="btn-text"
              onClick={() => setShowForm(!showForm)}
              type="button"
            >
              {showForm ? "▲ 詳細を閉じる" : "▼ 顧客名・住所も入力する"}
            </button>
            {showForm && (
              <div className="new-project-fields">
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="顧客名（空欄なら「未設定」）"
                  onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
                />
                <input
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                  placeholder="現場住所（任意）"
                  onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status filter */}
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

      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginTop: "var(--sp-2)" }}>
        <span className="filter-count">{filtered.length}件表示</span>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
        >
          {showAdvancedFilter ? "▲ フィルタを閉じる" : "▼ 詳細フィルタ"}
        </button>
      </div>

      {showAdvancedFilter && (
        <div className="filter-panel">
          <div className="form-row">
            <label>
              顧客
              <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}>
                <option value="all">すべての顧客</option>
                {customers.map((c) => (
                  <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>
                ))}
              </select>
            </label>
            <label>
              担当者
              <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
                <option value="all">すべての担当者</option>
                {staffMembers.map((s) => (
                  <option key={s.id} value={s.id}>{s.display_name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              作成日（From）
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <label>
              作成日（To）
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
          </div>
          <div>
            <button
              className="btn btn-sm"
              onClick={() => {
                setCustomerFilter("all");
                setStaffFilter("all");
                setDateFrom("");
                setDateTo("");
              }}
            >
              リセット
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      {projects.length > 5 && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="検索..."
          style={{ maxWidth: 300 }}
        />
      )}

      {/* Projects list - カード形式 */}
      <div className="project-list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            {loading ? "読み込み中..." : "案件がありません。上のフォームから作成してください。"}
          </div>
        ) : (
          filtered.map((p) => (
            <Link
              key={p.project_id}
              href={`/projects/${p.project_id}`}
              className="project-card"
            >
              <div className="project-card-main">
                <div className="project-card-name">{p.project_name}</div>
                <div className="project-card-meta">
                  {p.customer_name}{p.site_address ? ` / ${p.site_address}` : ""}
                </div>
              </div>
              <span className={statusBadgeClass(p.project_status)}>{p.project_status}</span>
            </Link>
          ))
        )}
      </div>

      {message && (
        <p className={`message ${message.includes("失敗") || message.includes("入力") ? "message-error" : "message-success"}`}>
          {message}
        </p>
      )}
    </main>
  );
}
