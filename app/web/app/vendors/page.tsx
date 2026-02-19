"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getVendors,
  createVendor,
  updateVendor,
  deleteVendor,
  type Vendor,
} from "../../lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Message = { type: "success" | "error"; text: string } | null;

type VendorFormData = {
  vendor_name: string;
  vendor_type: "subcontractor" | "supplier";
  specialty: string;
  phone: string;
  note: string;
};

const EMPTY_FORM: VendorFormData = {
  vendor_name: "",
  vendor_type: "subcontractor",
  specialty: "",
  phone: "",
  note: "",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatYen(amount: number): string {
  return `¥${Math.round(amount).toLocaleString()}`;
}

function vendorTypeBadge(type: Vendor["vendor_type"]) {
  if (type === "subcontractor") {
    return <span className="badge badge-blue">協力会社</span>;
  }
  return <span className="badge badge-default">仕入先</span>;
}

// ---------------------------------------------------------------------------
// Modal Component
// ---------------------------------------------------------------------------

function VendorModal({
  open,
  title,
  form,
  saving,
  onChange,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  form: VendorFormData;
  saving: boolean;
  onChange: (field: keyof VendorFormData, value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.4)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflowY: "auto",
          margin: 16,
        }}
      >
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 600 }}>
          {title}
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          style={{ display: "grid", gap: 16 }}
        >
          <label>
            <span style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>
              会社名 <span style={{ color: "var(--c-danger, #e53e3e)" }}>*</span>
            </span>
            <input
              type="text"
              required
              value={form.vendor_name}
              onChange={(e) => onChange("vendor_name", e.target.value)}
              placeholder="例: 山田塗装工業"
              autoFocus
            />
          </label>

          <label>
            <span style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>
              種別
            </span>
            <select
              value={form.vendor_type}
              onChange={(e) => onChange("vendor_type", e.target.value)}
            >
              <option value="subcontractor">協力会社</option>
              <option value="supplier">仕入先</option>
            </select>
          </label>

          <label>
            <span style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>
              専門分野
            </span>
            <input
              type="text"
              value={form.specialty}
              onChange={(e) => onChange("specialty", e.target.value)}
              placeholder="例: 内装・クロス"
            />
          </label>

          <label>
            <span style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>
              電話番号
            </span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => onChange("phone", e.target.value)}
              placeholder="例: 03-1234-5678"
            />
          </label>

          <label>
            <span style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>
              備考
            </span>
            <textarea
              value={form.note}
              onChange={(e) => onChange("note", e.target.value)}
              placeholder="メモ・補足情報など"
              rows={3}
            />
          </label>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={saving}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !form.vendor_name.trim()}
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<Message>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [form, setForm] = useState<VendorFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getVendors();
      setVendors(data);
    } catch {
      setMessage({ type: "error", text: "仕入先・協力会社の読み込みに失敗しました" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // -----------------------------------------------------------------------
  // Auto-dismiss messages
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  // -----------------------------------------------------------------------
  // Modal handlers
  // -----------------------------------------------------------------------

  const openCreateModal = () => {
    setEditingVendor(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setForm({
      vendor_name: vendor.vendor_name,
      vendor_type: vendor.vendor_type,
      specialty: vendor.specialty ?? "",
      phone: vendor.phone ?? "",
      note: vendor.note ?? "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingVendor(null);
    setForm(EMPTY_FORM);
  };

  const handleFormChange = (field: keyof VendorFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // -----------------------------------------------------------------------
  // CRUD handlers
  // -----------------------------------------------------------------------

  const handleSave = async () => {
    const name = form.vendor_name.trim();
    if (!name) return;

    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        vendor_name: name,
        vendor_type: form.vendor_type,
        specialty: form.specialty.trim() || undefined,
        phone: form.phone.trim() || undefined,
        note: form.note.trim() || undefined,
      };

      if (editingVendor) {
        await updateVendor(editingVendor.vendor_id, payload);
        setMessage({ type: "success", text: `「${name}」を更新しました` });
      } else {
        await createVendor(payload);
        setMessage({ type: "success", text: `「${name}」を登録しました` });
      }

      closeModal();
      await load();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "保存に失敗しました",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (vendor: Vendor) => {
    const confirmed = window.confirm(
      `「${vendor.vendor_name}」を削除しますか？\nこの操作は元に戻せません。`
    );
    if (!confirmed) return;

    setMessage(null);
    try {
      await deleteVendor(vendor.vendor_id);
      setMessage({ type: "success", text: `「${vendor.vendor_name}」を削除しました` });
      await load();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "削除に失敗しました",
      });
    }
  };

  // -----------------------------------------------------------------------
  // Render: Loading state
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>仕入先・協力会社</h1>
        </div>
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <p style={{ color: "var(--c-text-3, #888)" }}>読み込み中...</p>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render: Main
  // -----------------------------------------------------------------------

  return (
    <div className="page">
      <div className="page-header">
        <h1>仕入先・協力会社</h1>
        <button className="btn btn-primary" onClick={openCreateModal}>
          新規登録
        </button>
      </div>

      {message && (
        <p
          className={`message ${
            message.type === "success" ? "message-success" : "message-error"
          }`}
        >
          {message.text}
        </p>
      )}

      {vendors.length === 0 ? (
        <div className="empty-state">
          仕入先・協力会社がまだ登録されていません。「新規登録」から追加してください。
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>会社名</th>
                  <th>種別</th>
                  <th>専門分野</th>
                  <th>電話番号</th>
                  <th style={{ textAlign: "right" }}>年間発注額</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.vendor_id}>
                    <td>{v.vendor_name}</td>
                    <td>{vendorTypeBadge(v.vendor_type)}</td>
                    <td>{v.specialty ?? "—"}</td>
                    <td>{v.phone ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      {formatYen(v.annual_order_amount)}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => openEditModal(v)}
                        >
                          編集
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => void handleDelete(v)}
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <VendorModal
        open={modalOpen}
        title={editingVendor ? "仕入先・協力会社を編集" : "仕入先・協力会社を新規登録"}
        form={form}
        saving={saving}
        onChange={handleFormChange}
        onSubmit={() => void handleSave()}
        onClose={closeModal}
      />
    </div>
  );
}
