"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  getDashboardOverview, getCustomerRanking, getYoYData,
  getStaffPerformance, getTargetVsActual, getTargets,
  getStaffMembers, upsertTarget,
  getCollectionMetrics, getUnpaidInvoices,
  type DashboardOverview, type CustomerRankingItem,
  type YoYMonthlyPoint, type StaffPerformance as StaffPerformanceType,
  type StaffTargetVsActual, type StaffMember, type StaffMonthlyTarget,
  type CollectionMetrics, type UnpaidInvoice,
} from "../lib/api";

const CustomerRanking = dynamic(() => import("../components/dashboard/CustomerRanking"), { ssr: false });
const YoYGrowthChart = dynamic(() => import("../components/dashboard/YoYGrowthChart"), { ssr: false });
const StaffPerformanceView = dynamic(() => import("../components/dashboard/StaffPerformance"), { ssr: false });
const TargetTracking = dynamic(() => import("../components/dashboard/TargetTracking"), { ssr: false });
const TargetSettingsModal = dynamic(() => import("../components/dashboard/TargetSettingsModal"), { ssr: false });
const PaymentOverview = dynamic(() => import("../components/dashboard/PaymentOverview"), { ssr: false });
const ReportView = dynamic(() => import("../components/dashboard/ReportView"), { ssr: false });

function yen(value: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "¥0";
  return `¥${Math.round(n).toLocaleString()}`;
}

function pct(value: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.0%";
  return `${n.toFixed(1)}%`;
}

function statusBadgeClass(status: string) {
  if (status === "見積中") return "badge badge-default";
  if (status === "受注") return "badge badge-blue";
  if (status === "施工中") return "badge badge-warning";
  if (status === "完了" || status === "請求済") return "badge badge-success";
  if (status === "入金済") return "badge badge-success";
  return "badge badge-default";
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Tab system
  const [activeTab, setActiveTab] = useState<string>("projects");
  const [customerRanking, setCustomerRanking] = useState<CustomerRankingItem[] | null>(null);
  const [yoyData, setYoyData] = useState<YoYMonthlyPoint[] | null>(null);
  const [staffPerf, setStaffPerf] = useState<StaffPerformanceType[] | null>(null);
  const [targetData, setTargetData] = useState<StaffTargetVsActual[] | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [targets, setTargets] = useState<StaffMonthlyTarget[]>([]);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [collectionMetrics, setCollectionMetrics] = useState<CollectionMetrics | null>(null);
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[] | null>(null);
  const [tabLoading, setTabLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getDashboardOverview());
    } catch (e) {
      setError(e instanceof Error ? e.message : "データ取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  // Tab data loading
  useEffect(() => {
    if (activeTab === "projects" || !activeTab) return;

    let cancelled = false;
    setTabLoading(true);

    const loadTab = async () => {
      try {
        if (activeTab === "customers" && !customerRanking) {
          const d = await getCustomerRanking();
          if (!cancelled) setCustomerRanking(d);
        } else if (activeTab === "yoy" && !yoyData) {
          const d = await getYoYData(new Date().getFullYear());
          if (!cancelled) setYoyData(d);
        } else if (activeTab === "staff" && !staffPerf) {
          const d = await getStaffPerformance();
          if (!cancelled) setStaffPerf(d);
        } else if (activeTab === "targets") {
          const year = new Date().getFullYear();
          const [tva, sm, tg] = await Promise.all([
            getTargetVsActual(year),
            getStaffMembers(),
            getTargets(year),
          ]);
          if (!cancelled) {
            setTargetData(tva);
            setStaffMembers(sm);
            setTargets(tg);
          }
        } else if (activeTab === "payments" && !collectionMetrics) {
          const [metrics, invs] = await Promise.all([
            getCollectionMetrics(),
            getUnpaidInvoices(),
          ]);
          if (!cancelled) {
            setCollectionMetrics(metrics);
            setUnpaidInvoices(invs);
          }
        }
      } catch (e) {
        console.error("Tab data load error:", e);
      } finally {
        if (!cancelled) setTabLoading(false);
      }
    };
    loadTab();
    return () => { cancelled = true; };
  }, [activeTab]);

  const chartPeak = useMemo(() => {
    if (!data) return 1;
    return Math.max(...data.monthly_sales.map((x) => x.amount), 1);
  }, [data]);

  if (loading && !data) {
    return <main className="page"><p style={{ textAlign: "center", padding: 40, color: "var(--c-text-4)" }}>読み込み中...</p></main>;
  }

  const d = data;

  return (
    <main className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>経営ダッシュボード</h1>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--c-text-3)" }}>
            銀行融資判断・経営意思決定のための一覧
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--sp-2)" }}>
          <Link href="/projects" className="btn btn-primary" style={{ textDecoration: "none" }}>案件管理</Link>
          <button className="btn" onClick={() => void load()} disabled={loading}>更新</button>
        </div>
      </div>

      {/* KPI Row 1: 銀行が最も見たい4つの数字 */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <p className="kpi-label">今月売上</p>
          <p className="kpi-value">{yen(d?.current_month_sales ?? 0)}</p>
          <p className="kpi-sub">請求ベース</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">来月見込</p>
          <p className="kpi-value">{yen(d?.next_month_projection ?? 0)}</p>
          <p className="kpi-sub">受注+施工中の売値合計</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">パイプライン</p>
          <p className="kpi-value">{yen(d?.pipeline_total ?? 0)}</p>
          <p className="kpi-sub">{d?.pipeline_count ?? 0}件（見積中+受注）</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">通年売上（YTD）</p>
          <p className="kpi-value">{yen(d?.ytd_sales ?? 0)}</p>
          <p className="kpi-sub">
            前年比 {d && d.last_year_ytd_sales > 0
              ? <span className={d.yoy_growth_rate >= 0 ? "is-positive" : "is-negative"}>
                  {d.yoy_growth_rate >= 0 ? "+" : ""}{d.yoy_growth_rate.toFixed(1)}%
                </span>
              : <span style={{ color: "var(--c-text-4)" }}>前年データなし</span>
            }
          </p>
        </div>
      </div>

      {/* KPI Row 2: 収益性+資金繰り */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <p className="kpi-label">平均粗利率</p>
          <p className={`kpi-value ${(d?.avg_margin_rate ?? 0) >= 30 ? "is-positive" : "is-warning"}`}>
            {pct(d?.avg_margin_rate ?? 0)}
          </p>
          <p className="kpi-sub">全案件平均</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">売掛残（未回収）</p>
          <p className="kpi-value">{yen(d?.receivable_balance ?? 0)}</p>
          <p className="kpi-sub">請求済み未入金</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">買掛残（未払い）</p>
          <p className="kpi-value">{yen(d?.payable_balance ?? 0)}</p>
          <p className="kpi-sub">外注先への未払い</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">稼働案件数</p>
          <p className="kpi-value">{d?.active_project_count ?? 0}件</p>
          <p className="kpi-sub">
            {Object.entries(d?.status_counts ?? {})
              .filter(([k]) => k !== "失注" && k !== "入金済")
              .map(([k, v]) => `${k}${v}`)
              .join(" / ")}
          </p>
        </div>
      </div>

      {/* Charts + Finance */}
      <div className="dash-grid-2">
        {/* 売上推移チャート */}
        <div className="card">
          <div className="card-title">月次売上推移（今年）</div>
          <div className="chart-bar-grid">
            {(d?.monthly_sales ?? []).map((point) => (
              <div key={point.month} className="chart-bar-col">
                <div
                  className="chart-bar-fill"
                  style={{ height: `${Math.max((point.amount / chartPeak) * 100, 2)}%` }}
                />
                <span className="chart-bar-label">{point.month.replace("月", "")}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 仕入先ランキング */}
        <div className="card">
          <div className="card-title">主要仕入先（発注額順）</div>
          {(d?.top_vendors ?? []).map((v, i) => (
            <div key={v.vendor_name} className="stat-row">
              <span className="stat-label">{i + 1}. {v.vendor_name}（{v.count}件）</span>
              <span className="stat-value">{yen(v.amount)}</span>
            </div>
          ))}
          <p style={{ fontSize: 11, color: "var(--c-text-4)", marginTop: "var(--sp-2)" }}>
            掛け率交渉や年間発注額の把握に活用
          </p>
        </div>
      </div>

      {/* Analytics Tabs */}
      <div className="dash-section-tabs">
        {[
          { id: "projects", label: "稼働案件" },
          { id: "customers", label: "顧客ランキング" },
          { id: "yoy", label: "前年比" },
          { id: "staff", label: "スタッフ実績" },
          { id: "targets", label: "目標管理" },
          { id: "payments", label: "入金管理" },
          { id: "reports", label: "レポート" },
        ].map((tab) => (
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
      {tabLoading && activeTab !== "projects" ? (
        <div className="card">
          <p style={{ textAlign: "center", padding: 40, color: "var(--c-text-4)" }}>読み込み中...</p>
        </div>
      ) : activeTab === "projects" ? (
        <div className="card">
          <div className="card-title">稼働案件一覧</div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>案件</th>
                  <th>顧客</th>
                  <th>ステータス</th>
                  <th className="text-right">売値合計</th>
                  <th className="text-right">原価合計</th>
                  <th className="text-right">粗利</th>
                  <th className="text-right">粗利率</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {(d?.active_projects ?? []).length === 0 ? (
                  <tr className="empty-row"><td colSpan={8}>稼働案件はありません</td></tr>
                ) : (
                  (d?.active_projects ?? []).map((p) => (
                    <tr key={p.project_id}>
                      <td>
                        <span className="text-mono">{p.project_id}</span>
                        <br />
                        <span style={{ fontSize: 12 }}>{p.project_name}</span>
                      </td>
                      <td>{p.customer_name}</td>
                      <td><span className={statusBadgeClass(p.project_status)}>{p.project_status}</span></td>
                      <td className="text-right">{yen(p.selling_total)}</td>
                      <td className="text-right">{yen(p.cost_total)}</td>
                      <td className="text-right" style={{ fontWeight: 600 }}>{yen(p.margin)}</td>
                      <td className="text-right">
                        <span className={p.margin_rate >= 30 ? "is-positive" : p.margin_rate >= 20 ? "" : "is-negative"} style={{ fontWeight: 600 }}>
                          {pct(p.margin_rate)}
                        </span>
                      </td>
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
        </div>
      ) : activeTab === "customers" ? (
        <CustomerRanking data={customerRanking || []} />
      ) : activeTab === "yoy" ? (
        <YoYGrowthChart data={yoyData || []} />
      ) : activeTab === "staff" ? (
        <StaffPerformanceView data={staffPerf || []} />
      ) : activeTab === "targets" ? (
        <TargetTracking data={targetData || []} onEditTargets={() => setShowTargetModal(true)} />
      ) : activeTab === "payments" ? (
        collectionMetrics && unpaidInvoices ? (
          <PaymentOverview metrics={collectionMetrics} invoices={unpaidInvoices} />
        ) : null
      ) : activeTab === "reports" ? (
        <ReportView />
      ) : null}

      {showTargetModal && (
        <TargetSettingsModal
          isOpen={showTargetModal}
          onClose={() => setShowTargetModal(false)}
          year={new Date().getFullYear()}
          staff={staffMembers}
          targets={targets}
          onSave={async (t) => {
            await upsertTarget(t);
            const year = new Date().getFullYear();
            const [tva, tg] = await Promise.all([getTargetVsActual(year), getTargets(year)]);
            setTargetData(tva);
            setTargets(tg);
          }}
        />
      )}

      {error && <p className="message message-error">{error}</p>}
    </main>
  );
}
