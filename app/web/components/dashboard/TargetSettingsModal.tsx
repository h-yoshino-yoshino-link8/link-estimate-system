"use client";

import { useState, useEffect, useCallback } from "react";
import type { StaffMember, StaffMonthlyTarget } from "../../lib/api/types";

function yen(v: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "\u00a50";
  return `\u00a5${Math.round(n).toLocaleString()}`;
}

type MonthRow = {
  month: number;
  target_sales: number;
  target_profit: number;
  target_projects: number;
  saving: boolean;
};

export default function TargetSettingsModal({
  isOpen,
  onClose,
  year,
  staff,
  targets,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  staff: StaffMember[];
  targets: StaffMonthlyTarget[];
  onSave: (t: {
    staff_id: string;
    year: number;
    month: number;
    target_sales: number;
    target_profit: number;
    target_projects: number;
  }) => Promise<void>;
}) {
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [rows, setRows] = useState<MonthRow[]>([]);

  const buildRows = useCallback(
    (staffId: string) => {
      const monthRows: MonthRow[] = [];
      for (let m = 1; m <= 12; m++) {
        const existing = targets.find(
          (t) => t.staff_id === staffId && t.year === year && t.month === m
        );
        monthRows.push({
          month: m,
          target_sales: existing?.target_sales ?? 0,
          target_profit: existing?.target_profit ?? 0,
          target_projects: existing?.target_projects ?? 0,
          saving: false,
        });
      }
      return monthRows;
    },
    [targets, year]
  );

  useEffect(() => {
    if (staff.length > 0 && !selectedStaffId) {
      setSelectedStaffId(staff[0].id);
    }
  }, [staff, selectedStaffId]);

  useEffect(() => {
    if (selectedStaffId) {
      setRows(buildRows(selectedStaffId));
    }
  }, [selectedStaffId, buildRows]);

  if (!isOpen) return null;

  const handleChange = (month: number, field: keyof Pick<MonthRow, "target_sales" | "target_profit" | "target_projects">, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.month === month ? { ...r, [field]: Number(value) || 0 } : r))
    );
  };

  const handleSave = async (row: MonthRow) => {
    setRows((prev) => prev.map((r) => (r.month === row.month ? { ...r, saving: true } : r)));
    try {
      await onSave({
        staff_id: selectedStaffId,
        year,
        month: row.month,
        target_sales: row.target_sales,
        target_profit: row.target_profit,
        target_projects: row.target_projects,
      });
    } finally {
      setRows((prev) => prev.map((r) => (r.month === row.month ? { ...r, saving: false } : r)));
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-content"
        style={{
          background: "var(--c-surface)",
          borderRadius: "var(--r-lg)",
          padding: "var(--sp-6)",
          width: "90%",
          maxWidth: 800,
          maxHeight: "85vh",
          overflow: "auto",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-5)" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{year}年 目標設定</h2>
          <button className="btn" onClick={onClose}>閉じる</button>
        </div>

        <div className="form-grid" style={{ marginBottom: "var(--sp-4)" }}>
          <label>
            スタッフ選択
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name}（{s.role}）
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedStaffId && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>月</th>
                  <th className="text-right">売上目標</th>
                  <th className="text-right">粗利目標</th>
                  <th className="text-right">案件目標</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.month}>
                    <td style={{ fontWeight: 600 }}>{row.month}月</td>
                    <td className="text-right">
                      <input
                        type="number"
                        value={row.target_sales || ""}
                        onChange={(e) => handleChange(row.month, "target_sales", e.target.value)}
                        placeholder="0"
                        style={{ width: 120, textAlign: "right" }}
                      />
                    </td>
                    <td className="text-right">
                      <input
                        type="number"
                        value={row.target_profit || ""}
                        onChange={(e) => handleChange(row.month, "target_profit", e.target.value)}
                        placeholder="0"
                        style={{ width: 120, textAlign: "right" }}
                      />
                    </td>
                    <td className="text-right">
                      <input
                        type="number"
                        value={row.target_projects || ""}
                        onChange={(e) => handleChange(row.month, "target_projects", e.target.value)}
                        placeholder="0"
                        style={{ width: 80, textAlign: "right" }}
                      />
                    </td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={row.saving}
                        onClick={() => void handleSave(row)}
                      >
                        {row.saving ? "..." : "保存"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: "var(--sp-4)", fontSize: 12, color: "var(--c-text-4)" }}>
          各月の目標を入力し「保存」ボタンで確定してください。
        </div>
      </div>
    </div>
  );
}
