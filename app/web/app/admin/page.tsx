"use client";

import { useEffect, useState } from "react";
import {
  getSystemStatus, getUserProfiles, updateUserRole, getEmailLogs,
} from "../../lib/api";
import type { TableStat, UserProfile, EmailLog } from "../../lib/api";

type TabId = "system" | "users" | "email-logs";

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("system");

  // System tab
  const [tableStats, setTableStats] = useState<TableStat[]>([]);

  // Users tab (lazy)
  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [savingRole, setSavingRole] = useState<string | null>(null);

  // Email logs tab (lazy)
  const [emailLogs, setEmailLogs] = useState<EmailLog[] | null>(null);

  const [tabLoading, setTabLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    // Clear caches so refresh re-fetches everything
    setUsers(null);
    setEmailLogs(null);
    try {
      const stats = await getSystemStatus();
      setTableStats(stats);
    } catch (e) {
      console.error("System status load error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  // Lazy tab loading
  useEffect(() => {
    if (activeTab === "system") return;

    let cancelled = false;
    setTabLoading(true);

    const loadTab = async () => {
      try {
        if (activeTab === "users" && !users) {
          const d = await getUserProfiles();
          if (!cancelled) setUsers(d);
        } else if (activeTab === "email-logs" && !emailLogs) {
          const d = await getEmailLogs();
          if (!cancelled) setEmailLogs(d);
        }
      } catch (e) {
        console.error("Tab data load error:", e);
      } finally {
        if (!cancelled) setTabLoading(false);
      }
    };
    loadTab();
    return () => { cancelled = true; };
  }, [activeTab, users, emailLogs]);

  const handleRoleChange = async (userId: string, role: string) => {
    setSavingRole(userId);
    try {
      await updateUserRole(userId, role);
      setUsers((prev) =>
        prev ? prev.map((u) => (u.id === userId ? { ...u, role } : u)) : prev
      );
    } catch (e) {
      console.error("Role update error:", e);
    } finally {
      setSavingRole(null);
    }
  };

  // Computed values
  const totalRecords = tableStats.reduce((s, t) => s + t.count, 0);
  const estimatedMB = (totalRecords * 500) / 1024 / 1024;
  const usagePercent = (estimatedMB / 500) * 100;

  const tabs: { id: TabId; label: string }[] = [
    { id: "system", label: "システム概要" },
    { id: "users", label: "ユーザー管理" },
    { id: "email-logs", label: "メールログ" },
  ];

  if (loading && tableStats.length === 0) {
    return (
      <main className="page">
        <p style={{ textAlign: "center", padding: 40, color: "var(--c-text-4)" }}>読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>システム管理</h1>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--c-text-3)" }}>
            データベース・ユーザー・メール送信の管理
          </p>
        </div>
        <button className="btn" onClick={() => void load()} disabled={loading}>更新</button>
      </div>

      {/* Tabs */}
      <div className="dash-section-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`dash-section-tab${activeTab === tab.id ? " is-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tabLoading && activeTab !== "system" ? (
        <div className="card">
          <p style={{ textAlign: "center", padding: 40, color: "var(--c-text-4)" }}>読み込み中...</p>
        </div>
      ) : activeTab === "system" ? (
        <>
          {/* KPI cards */}
          <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="kpi-card">
              <p className="kpi-label">合計レコード数</p>
              <p className="kpi-value">{totalRecords.toLocaleString()}</p>
              <p className="kpi-sub">全テーブル合計</p>
            </div>
            <div className="kpi-card">
              <p className="kpi-label">推定データ容量</p>
              <p className="kpi-value">{estimatedMB.toFixed(1)} MB</p>
              <p className="kpi-sub">レコード数 x 500B で概算</p>
            </div>
            <div className="kpi-card">
              <p className="kpi-label">Freeプラン使用率</p>
              <p className={`kpi-value ${usagePercent > 80 ? "is-warning" : ""}`}>
                {usagePercent.toFixed(1)}%
              </p>
              <p className="kpi-sub">500MB中</p>
            </div>
          </div>

          {/* Capacity bar */}
          <div className="admin-capacity-bar">
            <div
              className="admin-capacity-fill"
              style={{
                width: `${Math.min(usagePercent, 100)}%`,
                background: usagePercent > 90 ? "var(--c-error)" : usagePercent > 80 ? "var(--c-warning)" : "var(--c-primary)",
              }}
            />
          </div>
          <p className="admin-capacity-label">
            Supabase Freeプラン: 推定 {estimatedMB.toFixed(1)}MB / 500MB 使用中
          </p>

          {/* Table stats */}
          <div className="admin-section">
            <div className="admin-section-title">テーブル別レコード数</div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>テーブル名</th>
                    <th className="text-right">レコード数</th>
                    <th>説明</th>
                  </tr>
                </thead>
                <tbody>
                  {tableStats.map((t) => (
                    <tr key={t.table_name}>
                      <td style={{ fontWeight: 500 }}>{t.display_name}</td>
                      <td className="text-right">{t.count.toLocaleString()}</td>
                      <td style={{ color: "var(--c-text-3)", fontSize: 13 }}>{t.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : activeTab === "users" ? (
        <div className="card">
          <div className="card-title">ユーザー一覧</div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>表示名</th>
                  <th>役割</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {(users ?? []).length === 0 ? (
                  <tr className="empty-row"><td colSpan={3}>ユーザーはいません</td></tr>
                ) : (
                  (users ?? []).map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>{u.display_name || "未設定"}</td>
                      <td>
                        <span className={`badge ${u.role === "admin" ? "badge-blue" : "badge-default"}`}>
                          {u.role || "member"}
                        </span>
                      </td>
                      <td>
                        <select
                          className="admin-role-select"
                          value={u.role || "member"}
                          onChange={(e) => void handleRoleChange(u.id, e.target.value)}
                          disabled={savingRole === u.id}
                        >
                          <option value="admin">管理者</option>
                          <option value="member">メンバー</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === "email-logs" ? (
        <div className="card">
          <div className="card-title">メール送信ログ</div>
          {(emailLogs ?? []).length === 0 ? (
            <p style={{ textAlign: "center", padding: 40, color: "var(--c-text-4)" }}>送信履歴はありません</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>送信日時</th>
                    <th>宛先</th>
                    <th>件名</th>
                    <th>ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {(emailLogs ?? []).map((log) => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>
                        {new Date(log.sent_at).toLocaleString("ja-JP")}
                      </td>
                      <td>{log.to_email}</td>
                      <td>{log.subject}</td>
                      <td>
                        <span
                          className={`badge ${log.status === "success" ? "badge-success" : ""}`}
                          style={log.status === "error" ? { background: "#fef2f2", color: "#dc2626" } : undefined}
                        >
                          {log.status === "success" ? "成功" : "エラー"}
                        </span>
                        {log.error_message && (
                          <p style={{ fontSize: 11, color: "var(--c-error)", margin: "4px 0 0" }}>{log.error_message}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </main>
  );
}
