"use client";

import { Fragment, useEffect, useState, useMemo, useCallback } from "react";
import {
  getWorkItems,
  createWorkItem,
  updateWorkItem,
  deleteWorkItem,
  type WorkItemMaster,
} from "../../lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`;

function calcMarginRate(selling: number, cost: number): number {
  if (selling === 0) return 0;
  return ((selling - cost) / selling) * 100;
}

function marginRateClass(rate: number): string {
  if (rate >= 30) return "margin-rate is-good";
  if (rate >= 15) return "margin-rate is-ok";
  return "margin-rate is-low";
}

const UNIT_OPTIONS = ["式", "m2", "m", "枚", "台", "箇所", "本", "組", "セット"];

type FormData = {
  category: string;
  item_name: string;
  specification: string;
  unit: string;
  cost_price: string;
  selling_price: string;
};

const emptyForm: FormData = {
  category: "",
  item_name: "",
  specification: "",
  unit: "",
  cost_price: "",
  selling_price: "",
};

// ---------------------------------------------------------------------------
// Modal Component
// ---------------------------------------------------------------------------

function WorkItemModal({
  isOpen,
  editingItem,
  existingCategories,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  editingItem: WorkItemMaster | null;
  existingCategories: string[];
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
}) {
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (editingItem) {
        setForm({
          category: editingItem.category,
          item_name: editingItem.item_name,
          specification: editingItem.specification ?? "",
          unit: editingItem.unit,
          cost_price: String(editingItem.cost_price),
          selling_price: String(editingItem.selling_price),
        });
      } else {
        setForm(emptyForm);
      }
      setError("");
    }
  }, [isOpen, editingItem]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.item_name.trim()) {
      setError("項目名は必須です");
      return;
    }
    if (!form.category.trim()) {
      setError("カテゴリは必須です");
      return;
    }
    if (!form.unit.trim()) {
      setError("単位は必須です");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const setField = (key: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
        }}
      />
      {/* Modal Card */}
      <div
        style={{
          position: "relative",
          backgroundColor: "#fff",
          borderRadius: 12,
          padding: "28px 32px",
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {editingItem ? "工事項目を編集" : "工事項目を追加"}
          </h2>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            type="button"
            style={{ fontSize: 18, lineHeight: 1, padding: "4px 8px" }}
          >
            ✕
          </button>
        </div>

        {error && <p className="message message-error" style={{ marginBottom: 16 }}>{error}</p>}

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Category */}
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>カテゴリ <span style={{ color: "#e53e3e" }}>*</span></span>
              <input
                list="category-list"
                value={form.category}
                onChange={(e) => setField("category", e.target.value)}
                placeholder="例: 内装、設備、諸経費"
                required
              />
              <datalist id="category-list">
                {existingCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>

            {/* Item Name */}
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>項目名 <span style={{ color: "#e53e3e" }}>*</span></span>
              <input
                value={form.item_name}
                onChange={(e) => setField("item_name", e.target.value)}
                placeholder="例: クロス貼替（量産）"
                required
              />
            </label>

            {/* Specification */}
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>仕様</span>
              <input
                value={form.specification}
                onChange={(e) => setField("specification", e.target.value)}
                placeholder="例: サンゲツ SP / 量産クロス"
              />
            </label>

            {/* Unit */}
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>単位 <span style={{ color: "#e53e3e" }}>*</span></span>
              <input
                list="unit-list"
                value={form.unit}
                onChange={(e) => setField("unit", e.target.value)}
                placeholder="例: m2、式、台"
                required
              />
              <datalist id="unit-list">
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </label>

            {/* Prices row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>原価（税抜）</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.cost_price}
                  onChange={(e) => setField("cost_price", e.target.value)}
                  placeholder="0"
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>売価（税抜）</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.selling_price}
                  onChange={(e) => setField("selling_price", e.target.value)}
                  placeholder="0"
                />
              </label>
            </div>

            {/* Preview margin */}
            {form.cost_price && form.selling_price && (
              <div style={{ fontSize: 13, color: "#666", padding: "8px 12px", background: "#f8fafc", borderRadius: 8 }}>
                粗利率:{" "}
                <span className={marginRateClass(calcMarginRate(Number(form.selling_price), Number(form.cost_price)))}>
                  {calcMarginRate(Number(form.selling_price), Number(form.cost_price)).toFixed(1)}%
                </span>
                {" / "}
                粗利額: {yen(Number(form.selling_price) - Number(form.cost_price))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
            <button className="btn" type="button" onClick={onClose} disabled={saving}>
              キャンセル
            </button>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "保存中..." : editingItem ? "更新" : "追加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function WorkItemsPage() {
  const [items, setItems] = useState<WorkItemMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Filter
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkItemMaster | null>(null);

  // ---- Data loading ----
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getWorkItems();
      setItems(data);
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "データ取得に失敗しました", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ---- Derived data ----
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const item of items) {
      if (item.category) cats.add(item.category);
    }
    return Array.from(cats).sort();
  }, [items]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const item of items) {
      const cat = item.category || "未分類";
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    if (categoryFilter === "all") return items;
    return items.filter((item) => item.category === categoryFilter);
  }, [items, categoryFilter]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, WorkItemMaster[]>();
    for (const item of filteredItems) {
      const cat = item.category || "未分類";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(item);
    }
    return groups;
  }, [filteredItems]);

  // ---- Handlers ----
  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: WorkItemMaster) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingItem(null);
  };

  const handleSave = async (form: FormData) => {
    const payload = {
      category: form.category.trim(),
      item_name: form.item_name.trim(),
      specification: form.specification.trim() || undefined,
      unit: form.unit.trim(),
      cost_price: Number(form.cost_price) || 0,
      selling_price: Number(form.selling_price) || 0,
    };

    if (editingItem) {
      await updateWorkItem(editingItem.id, payload);
      showMessage(`「${payload.item_name}」を更新しました`, "success");
    } else {
      await createWorkItem(payload);
      showMessage(`「${payload.item_name}」を追加しました`, "success");
    }

    handleCloseModal();
    await load();
  };

  const handleDelete = async (item: WorkItemMaster) => {
    const confirmed = window.confirm(
      `「${item.item_name}」を削除しますか？\nこの操作は取り消せません。`
    );
    if (!confirmed) return;

    try {
      await deleteWorkItem(item.id);
      showMessage(`「${item.item_name}」を削除しました`, "success");
      await load();
    } catch (e) {
      showMessage(e instanceof Error ? e.message : "削除に失敗しました", "error");
    }
  };

  // ---- Render ----
  return (
    <main className="page">
      {/* Page Header */}
      <div className="page-header">
        <h1>単価表（工事項目マスタ）</h1>
        <button className="btn btn-primary" onClick={handleOpenCreate}>
          + 新規追加
        </button>
      </div>

      {/* Messages */}
      {message && (
        <p className={`message ${message.type === "success" ? "message-success" : "message-error"}`}>
          {message.text}
        </p>
      )}

      {/* Category Filter Chips */}
      <div className="status-pipeline">
        <button
          className={`status-chip ${categoryFilter === "all" ? "is-active" : ""}`}
          onClick={() => setCategoryFilter("all")}
        >
          すべて<span className="chip-count">{categoryCounts.all ?? 0}</span>
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            className={`status-chip ${categoryFilter === cat ? "is-active" : ""}`}
            onClick={() => setCategoryFilter(cat)}
          >
            {cat}<span className="chip-count">{categoryCounts[cat] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="empty-state">読み込み中...</div>
      )}

      {/* Empty State */}
      {!loading && items.length === 0 && (
        <div className="empty-state">
          工事項目が登録されていません。「新規追加」ボタンから登録してください。
        </div>
      )}

      {/* Empty State for filtered */}
      {!loading && items.length > 0 && filteredItems.length === 0 && (
        <div className="empty-state">
          「{categoryFilter}」カテゴリの項目はありません。
        </div>
      )}

      {/* Work Items Table */}
      {!loading && filteredItems.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>カテゴリ</th>
                <th>項目名</th>
                <th>仕様</th>
                <th>単位</th>
                <th className="text-right">原価</th>
                <th className="text-right">売価</th>
                <th className="text-right">粗利率</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(groupedItems.entries()).map(([category, groupItems]) => {
                const groupCostTotal = groupItems.reduce((sum, item) => sum + item.cost_price, 0);
                const groupSellingTotal = groupItems.reduce((sum, item) => sum + item.selling_price, 0);
                const groupMargin = groupSellingTotal > 0
                  ? calcMarginRate(groupSellingTotal, groupCostTotal)
                  : 0;

                return (
                  <Fragment key={category}>
                    {/* Group Header */}
                    <tr className="group-header">
                      <td colSpan={8}>
                        {category}
                        <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, opacity: 0.7 }}>
                          ({groupItems.length}件 / 平均粗利率 {groupMargin.toFixed(1)}%)
                        </span>
                      </td>
                    </tr>

                    {/* Group Items */}
                    {groupItems.map((item) => {
                      const rate = calcMarginRate(item.selling_price, item.cost_price);
                      return (
                        <tr key={item.id}>
                          <td>{item.category}</td>
                          <td><strong>{item.item_name}</strong></td>
                          <td style={{ color: "#888", fontSize: 13 }}>{item.specification ?? "—"}</td>
                          <td>{item.unit}</td>
                          <td className="text-right">{yen(item.cost_price)}</td>
                          <td className="text-right">{yen(item.selling_price)}</td>
                          <td className="text-right">
                            <span className={marginRateClass(rate)}>
                              {rate.toFixed(1)}%
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button
                                className="btn btn-sm btn-ghost"
                                onClick={() => handleOpenEdit(item)}
                              >
                                編集
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => void handleDelete(item)}
                              >
                                削除
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <WorkItemModal
        isOpen={modalOpen}
        editingItem={editingItem}
        existingCategories={categories}
        onClose={handleCloseModal}
        onSave={handleSave}
      />
    </main>
  );
}
