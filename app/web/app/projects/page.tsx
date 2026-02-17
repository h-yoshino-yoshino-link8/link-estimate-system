"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createProject, getCustomers, getProjects, type Project } from "../../lib/api";

type Customer = {
  customer_id: string;
  customer_name: string;
};

export default function ProjectsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const onCreateProject = async () => {
    if (!projectName.trim()) {
      setMessage("物件名を入力してください");
      return;
    }

    setWorking(true);
    setMessage("");
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
      setMessage(`案件を作成しました: ${created.project_id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "案件作成に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Project Hub</p>
        <h1>案件管理</h1>
        <p className="sub">案件を作成し、担当者がそのまま見積・請求・支払へ進める入口です。</p>
      </section>

      <section className="workspace-grid">
        <article className="panel">
          <h2>新規案件作成</h2>
          <label>
            顧客ID
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={working || loading}>
              {customers.map((c) => (
                <option key={c.customer_id} value={c.customer_id}>
                  {c.customer_id} / {c.customer_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            物件名
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
          </label>
          <label>
            施工住所
            <input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} />
          </label>
          <label>
            担当者
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </label>
          <label>
            目標粗利率
            <input value={marginRate} onChange={(e) => setMarginRate(e.target.value)} />
          </label>
          <button onClick={onCreateProject} disabled={working || loading}>
            案件を作成
          </button>
        </article>

        <article className="panel panel-span-2">
          <div className="panel-header-inline">
            <h2>案件一覧</h2>
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
                  <tr key={project.project_id}>
                    <td>{project.project_id}</td>
                    <td>
                      {project.project_name}
                      <br />
                      <span className="cell-sub">{project.site_address ?? "住所未設定"}</span>
                    </td>
                    <td>{project.customer_name}</td>
                    <td>{project.owner_name}</td>
                    <td>{project.project_status}</td>
                    <td>{project.created_at}</td>
                    <td>
                      <Link href={`/projects/${project.project_id}`} className="inline-link">
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

      {message ? <p className="message">{message}</p> : null}
    </main>
  );
}
