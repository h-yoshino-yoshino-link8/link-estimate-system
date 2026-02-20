"use client";

import type { StaffTargetVsActual } from "../../lib/api/types";

function yen(v: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "\u00a50";
  return `\u00a5${Math.round(n).toLocaleString()}`;
}

function achievementClass(rate: number): string {
  if (rate >= 100) return "is-exceeded";
  if (rate >= 70) return "is-on-track";
  if (rate >= 50) return "is-behind";
  return "is-far-behind";
}

function achievementColor(rate: number): string {
  if (rate >= 100) return "var(--c-success)";
  if (rate >= 70) return "#1e40af";
  if (rate >= 50) return "var(--c-warning)";
  return "var(--c-error)";
}

function ProgressBar({ label, actual, target }: { label: string; actual: number; target: number }) {
  const rate = target > 0 ? Math.round((actual / target) * 100) : 0;
  const widthPct = Math.min(rate, 100);
  const cls = achievementClass(rate);
  const color = achievementColor(rate);

  return (
    <div className="target-progress" style={{ marginBottom: "var(--sp-3)" }}>
      <div className="target-progress-header" style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
        <span className="target-progress-label" style={{ color: "var(--c-text-2)" }}>{label}</span>
        <span className="target-progress-value" style={{ fontWeight: 600, color: "var(--c-text-2)" }}>
          {yen(actual)} / {yen(target)} ({rate}%)
        </span>
      </div>
      <div
        className="target-progress-track"
        style={{
          height: 8,
          background: "#e2e8f0",
          borderRadius: "var(--r-full)",
          overflow: "hidden",
        }}
      >
        <div
          className={`target-progress-fill ${cls}`}
          style={{
            width: `${widthPct}%`,
            height: "100%",
            borderRadius: "var(--r-full)",
            background: color,
            transition: "width 0.3s",
          }}
        />
      </div>
    </div>
  );
}

export default function TargetTracking({
  data,
  onEditTargets,
}: {
  data: StaffTargetVsActual[];
  onEditTargets: () => void;
}) {
  const hasTargets = data.length > 0 && data.some((d) => d.target_sales > 0);

  if (!hasTargets) {
    return (
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-4)" }}>
          <div className="card-title" style={{ margin: 0 }}>目標達成状況</div>
          <button className="btn btn-primary btn-sm" onClick={onEditTargets}>
            目標設定
          </button>
        </div>
        <div className="empty-state">
          <p>目標が設定されていません</p>
          <button className="btn btn-primary" style={{ marginTop: "var(--sp-3)" }} onClick={onEditTargets}>
            目標を設定する
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-4)" }}>
        <div className="card-title" style={{ margin: 0 }}>目標達成状況</div>
        <button className="btn btn-primary btn-sm" onClick={onEditTargets}>
          目標設定
        </button>
      </div>

      {data.map((s) => (
        <div key={s.staff_id} style={{ marginBottom: "var(--sp-5)" }}>
          {s.target_sales > 0 && (
            <ProgressBar
              label={`${s.display_name} - 売上`}
              actual={s.actual_sales}
              target={s.target_sales}
            />
          )}
          {s.target_profit > 0 && (
            <ProgressBar
              label={`${s.display_name} - 粗利`}
              actual={s.actual_profit}
              target={s.target_profit}
            />
          )}
        </div>
      ))}
    </div>
  );
}
