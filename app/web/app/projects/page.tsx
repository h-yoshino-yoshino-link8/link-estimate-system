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
      <section className="hero">
        <p className="eyebrow">Project Hub</p>
        <h1>案件管理</h1>
        <p className="sub">案件を作成したら、その案件ページ内で見積・請求・支払・帳票を一気通貫で処理します。</p>
        {localMode ? <p className="warning">現在はローカルモードです。操作データはこのブラウザ内に保存されます。</p> : null}
      </section>

      <section className="workspace-grid">
        <article className="panel">
          <h2>新規案件作成</h2>
          <p className="form-help">
            <span className="required-mark">*</span> は必須項目です
          </p>
          <label>
            <span className="label-text">
              顧客 <span className="required-mark">*</span>
            </span>
            <select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setFieldErrors((prev) => ({ ...prev, customerId: "" })); }} disabled={working || loading}>
              {customers.map((c) => (
                <option key={c.customer_id} value={c.customer_id}>
                  {c.customer_id} / {c.customer_name}
                </option>
              ))}
            </select>
            {fieldErrors.customerId ? <span className="field-error">{fieldErrors.customerId}</span> : null}
          </label>
          <label>
            <span className="label-text">
              物件名 <span className="required-mark">*</span>
            </span>
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
          <label>
            <span className="label-text">担当者</span>
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </label>
          <label>
            <span className="label-text">
              目標粗利率 <span className="required-mark">*</span>
            </span>
            <input
              value={marginRate}
              onChange={(e) => { setMarginRate(e.target.value); setFieldErrors((prev) => ({ ...prev, marginRate: "" })); }}
              placeholder="0.25"
              className={fieldErrors.marginRate ? "input-error" : ""}
            />
            {fieldErrors.marginRate ? <span className="field-error">{fieldErrors.marginRate}</span> : null}
          </label>
          {formError ? <p className="form-error">{formError}</p> : null}
          <p className="fm-row-note">入力後に保存ボタンを押すと、案件が作成されて案件ワークスペースへ移動します。</p>
          <button className="btn-primary" onClick={onCreateProject} disabled={working || loading}>
            {working ? "保存中..." : "保存して案件を作成"}
          </button>
        </article>

        <article className="panel panel-span-2">
          <div className="panel-header-inline">
            <h2>案件一覧 <span className="count-badge">{filteredProjects.length}件</span></h2>
            <label className="inline-control">
              ステータス
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">すべて</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>

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
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => (
                  <tr key={project.project_id} className="table-row-hover">
                    <td><span className="id-mono">{project.project_id}</span></td>
                    <td>
                      <strong className="project-name-cell">{project.project_name}</strong>
                      <br />
                      <span className="cell-sub">{project.site_address ?? "住所未設定"}</span>
                    </td>
                    <td>{project.customer_name}</td>
                    <td>{project.owner_name}</td>
                    <td><span className="status-badge">{project.project_status}</span></td>
                    <td className="cell-sub">{project.created_at}</td>
                    <td>
                      <Link href={`/projects/${project.project_id}`} className="btn-open-ws">
                        開く
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredProjects.length === 0 ? <p className="item-row">該当する案件はありません。</p> : null}
        </article>
      </section>

      {message ? <p className={`message ${messageType === "error" ? "message-error" : ""} ${messageType === "success" ? "message-success" : ""}`}>{message}</p> : null}
    </main>
  );
}
