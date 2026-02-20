"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  type Customer,
} from "../../lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FormData = {
  customer_name: string;
  contact_name: string;
  phone: string;
  email: string;
  monthly_volume: string;
  status: string;
};

const EMPTY_FORM: FormData = {
  customer_name: "",
  contact_name: "",
  phone: "",
  email: "",
  monthly_volume: "",
  status: "新規",
};

const STATUS_OPTIONS = ["取引中", "休止中", "新規"] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadgeClass(status: string): string {
  if (status === "取引中") return "badge badge-success";
  if (status === "休止中") return "badge badge-default";
  if (status === "新規") return "badge badge-blue";
  return "badge badge-default";
}

// ---------------------------------------------------------------------------
// Modal Component
// ---------------------------------------------------------------------------

function CustomerModal({
  open,
  editing,
  form,
  saving,
  onChange,
  onSave,
  onClose,
}: {
  open: boolean;
  editing: Customer | null;
  form: FormData;
  saving: boolean;
  onChange: (key: keyof FormData, value: string) => void;
  onSave: () => void;
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
        backgroundColor: "rgba(0, 0, 0, 0.5)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 480,
          margin: "0 16px",
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        <h2 style={{ margin: "0 0 20px", fontSize: "18px" }}>
          {editing ? "顧客を編集" : "新規顧客登録"}
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
          style={{ display: "grid", gap: "16px" }}
        >
          <label>
            <span style={{ fontSize: "13px", fontWeight: 500, display: "block", marginBottom: "4px" }}>
              顧客名 <span style={{ color: "red" }}>*</span>
            </span>
            <input
              type="text"
              value={form.customer_name}
              onChange={(e) => onChange("customer_name", e.target.value)}
              placeholder="株式会社〇〇"
              required
              autoFocus
            />
          </label>

          <label>
            <span style={{ fontSize: "13px", fontWeight: 500, display: "block", marginBottom: "4px" }}>
              担当者名
            </span>
            <input
              type="text"
              value={form.contact_name}
              onChange={(e) => onChange("contact_name", e.target.value)}
              placeholder="山田太郎"
            />
          </label>

          <label>
            <span style={{ fontSize: "13px", fontWeight: 500, display: "block", marginBottom: "4px" }}>
              電話番号
            </span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => onChange("phone", e.target.value)}
              placeholder="03-1234-5678"
            />
          </label>

          <label>
            <span style={{ fontSize: "13px", fontWeight: 500, display: "block", marginBottom: "4px" }}>
              メールアドレス
            </span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => onChange("email", e.target.value)}
              placeholder="info@example.com"
            />
          </label>

          <label>
            <span style={{ fontSize: "13px", fontWeight: 500, display: "block", marginBottom: "4px" }}>
              月間取引量
            </span>
            <input
              type="text"
              value={form.monthly_volume}
              onChange={(e) => onChange("monthly_volume", e.target.value)}
              placeholder="月10件程度"
            />
          </label>

          <label>
            <span style={{ fontSize: "13px", fontWeight: 500, display: "block", marginBottom: "4px" }}>
              ステータス
            </span>
            <select
              value={form.status}
              onChange={(e) => onChange("status", e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
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
              disabled={saving || !form.customer_name.trim()}
            >
              {saving ? "保存中..." : editing ? "更新する" : "登録する"}
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

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // --------------------------------------------------
  // Data loading
  // --------------------------------------------------

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch {
      setMessage({ type: "error", text: "顧客データの取得に失敗しました" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-dismiss messages
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  // --------------------------------------------------
  // Modal handlers
  // --------------------------------------------------

  const openCreateModal = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditing(customer);
    setForm({
      customer_name: customer.customer_name,
      contact_name: customer.contact_name ?? "",
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      monthly_volume: customer.monthly_volume ?? "",
      status: customer.status || "新規",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleFormChange = (key: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // --------------------------------------------------
  // CRUD handlers
  // --------------------------------------------------

  const handleSave = async () => {
    const name = form.customer_name.trim();
    if (!name) return;

    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        customer_name: name,
        contact_name: form.contact_name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        monthly_volume: form.monthly_volume.trim() || undefined,
        status: form.status,
      };

      if (editing) {
        await updateCustomer(editing.customer_id, payload);
        setMessage({ type: "success", text: `「${name}」を更新しました` });
      } else {
        await createCustomer(payload);
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

  const handleDelete = async (customer: Customer) => {
    const confirmed = window.confirm(
      `「${customer.customer_name}」を削除しますか？\nこの操作は取り消せません。`
    );
    if (!confirmed) return;

    setMessage(null);

    try {
      await deleteCustomer(customer.customer_id);
      setMessage({ type: "success", text: `「${customer.customer_name}」を削除しました` });
      await load();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "削除に失敗しました",
      });
    }
  };

  // --------------------------------------------------
  // Render: Loading state
  // --------------------------------------------------

  if (loading && customers.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>顧客管理</h1>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "40px", color: "var(--c-text-3)" }}>
          読み込み中...
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // Render: Main
  // --------------------------------------------------

  return (
    <div className="page">
      <div className="page-header">
        <h1>顧客管理</h1>
        <button className="btn btn-primary" onClick={openCreateModal}>
          新規登録
        </button>
      </div>

      {message && (
        <p className={`message ${message.type === "success" ? "message-success" : "message-error"}`}>
          {message.text}
        </p>
      )}

      <div className="card">
        {customers.length === 0 ? (
          <div className="empty-state">
            顧客が登録されていません。「新規登録」ボタンから顧客を追加してください。
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>顧客名</th>
                  <th>担当者名</th>
                  <th>電話番号</th>
                  <th>メール</th>
                  <th>月間取引量</th>
                  <th>ステータス</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.customer_id}>
                    <td>
                      <Link href={`/customers/${c.customer_id}`} className="customer-link">
                        {c.customer_name}
                      </Link>
                    </td>
                    <td>{c.contact_name ?? "-"}</td>
                    <td>{c.phone ?? "-"}</td>
                    <td>{c.email || "\u2014"}</td>
                    <td>{c.monthly_volume ?? "-"}</td>
                    <td>
                      <span className={statusBadgeClass(c.status)}>
                        {c.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => openEditModal(c)}
                        >
                          編集
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => void handleDelete(c)}
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
        )}
      </div>

      <CustomerModal
        open={modalOpen}
        editing={editing}
        form={form}
        saving={saving}
        onChange={handleFormChange}
        onSave={() => void handleSave()}
        onClose={closeModal}
      />
    </div>
  );
}
