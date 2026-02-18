"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import {
  getProjects, createProjectQuick,
  PROJECT_STATUSES,
  type Project,
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
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

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
      const projData = await getProjects();
      setProjects(projData.items);
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
    return list;
  }, [projects, statusFilter, search]);

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
        <button className="btn" onClick={() => void load()} disabled={loading}>更新</button>
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
