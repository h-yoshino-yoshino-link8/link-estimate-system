"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  createProject,
  getCustomers,
  getProjects,
  isLocalModeEnabled,
  onLocalModeChanged,
  type Project,
} from "../../lib/api";

type Customer = {
  customer_id: string;
  customer_name: string;
};

export default function ProjectsPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [localMode, setLocalMode] = useState(false);

  const [customerId, setCustomerId] = useState("C-001");
  const [projectName, setProjectName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [ownerName, setOwnerName] = useState("吉野博");
  const [marginRate, setMarginRate] = useState("0.25");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const [customersData, projectsData] = await Promise.all([getCustomers(), getProjects()]);
      setCustomers(customersData);
      setProjects(projectsData.items);

      if (customersData.length > 0 && !customersData.find((c: Customer) => c.customer_id === customerId)) {
        setCustomerId(customersData[0].customer_id);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "案件情報の取得に失敗しました");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const refresh = () => setLocalMode(isLocalModeEnabled());
    refresh();
    const unsubscribe = onLocalModeChanged(refresh);
    window.addEventListener("focus", refresh);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const statuses = useMemo(
    () => Array.from(new Set(projects.map((x) => x.project_status).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [projects],
  );

  const filteredProjects = useMemo(() => {
    const rows = [...projects].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (statusFilter === "all") return rows;
    return rows.filter((x) => x.project_status === statusFilter);
  }, [projects, statusFilter]);

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!projectName.trim()) {
      errors.projectName = "物件名は必須です";
    }
    if (!customerId) {
      errors.customerId = "顧客を選択してください";
    }
    const margin = Number(marginRate || "0");
    if (!Number.isFinite(margin) || margin < 0 || margin > 1) {
      errors.marginRate = "0〜1 の範囲で入力してください（例: 0.25）";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onCreateProject = async () => {
    if (!validateForm()) {
      setFormError("入力内容を確認してください");
      return;
    }

    setWorking(true);
    setMessage("");
    setFormError("");
    setFieldErrors({});
    try {
      const created = await createProject({
        customer_id: customerId,
        project_name: projectName,
        site_address: siteAddress,
        owner_name: ownerName,
        target_margin_rate: Number(marginRate || "0.25"),
      });
      await load();
      setProjectName("");
      setSiteAddress("");
      setMessage(`案件を作成しました: ${created.project_id}${isLocalModeEnabled() ? "（ローカル保存）" : ""}`);
      setMessageType("success");
      router.push(`/projects/${created.project_id}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message.trim() : "";
      setMessage(detail || "案件作成に失敗しました。通信設定とローカルモードを確認してください。");
      setMessageType("error");
    } finally {
      setWorking(false);
    }
  };

  return (
    <main className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>案件管理</h1>
          <p className="page-header-sub">案件を作成し、見積・請求・支払・帳票を一気通貫で管理します</p>
        </div>
      </div>

      {localMode ? <div className="warning-bar">ローカルモード: 操作データはこのブラウザ内に保存されます（サーバー未接続）</div> : null}

      {message ? (
        <div className={`message ${messageType === "error" ? "message-error" : ""} ${messageType === "success" ? "message-success" : ""}`}>
          {message}
        </div>
      ) : null}

      {/* Main Layout: form sidebar + project list */}
      <div className="projects-layout">
        {/* Left: Create Form */}
        <div className="card project-form-card">
          <h2 className="card-title">新規案件作成</h2>
          <p className="form-help"><span className="required-mark">*</span> は必須項目</p>

          <div className="form-grid">
            <label>
              <span className="label-text">顧客 <span className="required-mark">*</span></span>
              <select
                value={customerId}
                onChange={(e) => { setCustomerId(e.target.value); setFieldErrors((prev) => ({ ...prev, customerId: "" })); }}
                disabled={working || loading}
              >
                {customers.map((c) => (
                  <option key={c.customer_id} value={c.customer_id}>
                    {c.customer_id} / {c.customer_name}
                  </option>
                ))}
              </select>
              {fieldErrors.customerId ? <span className="field-error">{fieldErrors.customerId}</span> : null}
            </label>

            <label>
              <span className="label-text">物件名 <span className="required-mark">*</span></span>
              <input
                value={projectName}
                onChange={(e) => { setProjectName(e.target.value); setFieldErrors((prev) => ({ ...prev, projectName: "" })); }}
                placeholder="例: 吉野邸キッチンリフォーム"
                className={fieldErrors.projectName ? "input-error" : ""}
              />
              {fieldErrors.projectName ? <span className="field-error">{fieldErrors.projectName}</span> : null}
            </label>

            <label>
              <span className="label-text">施工住所</span>
              <input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} placeholder="例: 東京都港区..." />
            </label>

            <div className="form-row-2">
              <label>
                <span className="label-text">担当者</span>
                <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              </label>
              <label>
                <span className="label-text">目標粗利率 <span className="required-mark">*</span></span>
                <input
                  value={marginRate}
                  onChange={(e) => { setMarginRate(e.target.value); setFieldErrors((prev) => ({ ...prev, marginRate: "" })); }}
                  placeholder="0.25"
                  className={fieldErrors.marginRate ? "input-error" : ""}
                />
                {fieldErrors.marginRate ? <span className="field-error">{fieldErrors.marginRate}</span> : null}
              </label>
            </div>

            {formError ? <div className="form-error">{formError}</div> : null}

            <button className="btn btn-primary" onClick={onCreateProject} disabled={working || loading} style={{ width: "100%", height: 40 }}>
              {working ? "保存中..." : "保存して案件を作成"}
            </button>
          </div>
        </div>

        {/* Right: Project List */}
        <div className="card">
          <div className="flex-between mb-4">
            <h2 className="card-title" style={{ margin: 0 }}>
              案件一覧 <span className="count-badge">{filteredProjects.length}件</span>
            </h2>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              ステータス
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: "auto" }}>
                <option value="all">すべて</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">&#128194;</div>
              <p className="empty-state-text">該当する案件はありません</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>案件ID</th>
                    <th>物件名</th>
                    <th>顧客</th>
                    <th>担当</th>
                    <th>ステータス</th>
                    <th>作成日</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project) => (
                    <tr key={project.project_id}>
                      <td><span className="id-mono">{project.project_id}</span></td>
                      <td>
                        <strong>{project.project_name}</strong>
                        <br />
                        <span className="text-muted" style={{ fontSize: 12 }}>{project.site_address ?? "住所未設定"}</span>
                      </td>
                      <td>{project.customer_name}</td>
                      <td>{project.owner_name}</td>
                      <td><span className="badge badge-default">{project.project_status}</span></td>
                      <td className="text-muted" style={{ fontSize: 12 }}>{project.created_at}</td>
                      <td>
                        <Link href={`/projects/${project.project_id}`} className="btn btn-sm btn-primary" style={{ textDecoration: "none" }}>
                          開く
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
