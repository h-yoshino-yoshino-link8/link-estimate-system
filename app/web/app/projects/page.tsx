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

  // Quick create
  const [customerName, setCustomerName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [creating, setCreating] = useState(false);

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

  const handleQuickCreate = async () => {
    if (!customerName.trim() || !projectName.trim()) {
      setMessage("顧客名と案件名を入力してください");
      return;
    }
    setCreating(true);
    setMessage("");
    try {
      await createProjectQuick({
        customer_name: customerName.trim(),
        project_name: projectName.trim(),
        site_address: siteAddress.trim() || undefined,
      });
      setCustomerName("");
      setProjectName("");
      setSiteAddress("");
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

      {/* Quick create - 1行で案件作成 */}
      <div className="quick-create">
        <input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="顧客名"
          style={{ flex: "0 0 160px" }}
        />
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="案件名（例: 桜台2F 原状回復）"
          style={{ flex: 1 }}
          onKeyDown={(e) => { if (e.key === "Enter") void handleQuickCreate(); }}
        />
        <input
          value={siteAddress}
          onChange={(e) => setSiteAddress(e.target.value)}
          placeholder="現場住所（任意）"
          style={{ flex: "0 0 200px" }}
          onKeyDown={(e) => { if (e.key === "Enter") void handleQuickCreate(); }}
        />
        <button className="btn btn-primary" onClick={() => void handleQuickCreate()} disabled={creating}>
          {creating ? "..." : "作成"}
        </button>
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

      {/* Projects table */}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>案件名</th>
              <th>顧客</th>
              <th>現場</th>
              <th>ステータス</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={5}>
                  {loading ? "読み込み中..." : "案件がありません。上のフォームから作成してください。"}
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.project_id}>
                  <td style={{ fontWeight: 500 }}>{p.project_name}</td>
                  <td>{p.customer_name}</td>
                  <td style={{ fontSize: 12, color: "var(--c-text-3)" }}>{p.site_address ?? "-"}</td>
                  <td><span className={statusBadgeClass(p.project_status)}>{p.project_status}</span></td>
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
        <p className={`message ${message.includes("失敗") || message.includes("入力") ? "message-error" : "message-success"}`}>
          {message}
        </p>
      )}
    </main>
  );
}
