"use client";

import { useEffect, useState } from "react";
import { getOrgSettings, updateOrgSettings, type OrgSettings } from "../../lib/api";

const FIELDS: { key: keyof OrgSettings; label: string; placeholder: string; multiline?: boolean }[] = [
  { key: "name", label: "会社名", placeholder: "株式会社〇〇" },
  { key: "postal_code", label: "郵便番号", placeholder: "123-4567" },
  { key: "address", label: "住所", placeholder: "東京都〇〇区〇〇 1-2-3" },
  { key: "phone", label: "電話番号", placeholder: "03-1234-5678" },
  { key: "fax", label: "FAX番号", placeholder: "03-1234-5679" },
  { key: "email", label: "メールアドレス", placeholder: "info@example.com" },
  { key: "invoice_number", label: "インボイス登録番号", placeholder: "T1234567890123" },
  { key: "bank_info", label: "振込先銀行情報", placeholder: "〇〇銀行 〇〇支店 普通 1234567", multiline: true },
  { key: "notes", label: "備考", placeholder: "見積書に表示する補足情報など", multiline: true },
];

export default function SettingsPage() {
  const [form, setForm] = useState<OrgSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrgSettings()
      .then(setForm)
      .catch(() => setMessage({ type: "error", text: "会社情報の読み込みに失敗しました" }))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key: keyof OrgSettings, value: string) => {
    if (!form) return;
    setForm({ ...form, [key]: value });
    setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateOrgSettings(form);
      setForm(updated);
      setMessage({ type: "success", text: "保存しました" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="page-header"><h1>会社設定</h1></div>
        <div className="card" style={{ textAlign: "center", padding: "40px", color: "var(--c-text-3)" }}>
          読み込み中...
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>会社設定</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ display: "grid", gap: "20px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--c-text-3)" }}>
            ここで設定した情報が見積書PDFに反映されます。
          </p>

          {FIELDS.map(({ key, label, placeholder, multiline }) => (
            <label key={key} style={{ display: "block" }}>
              <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--c-text-2)", display: "block", marginBottom: "4px" }}>
                {label}
              </span>
              {multiline ? (
                <textarea
                  value={form?.[key] ?? ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder={placeholder}
                  rows={3}
                  style={{
                    display: "block", width: "100%", padding: "10px 12px",
                    border: "1px solid var(--c-border)", borderRadius: "var(--r-sm)",
                    fontSize: "14px", fontFamily: "var(--font)", resize: "vertical",
                  }}
                />
              ) : (
                <input
                  type="text"
                  value={form?.[key] ?? ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder={placeholder}
                  style={{
                    display: "block", width: "100%", padding: "10px 12px",
                    border: "1px solid var(--c-border)", borderRadius: "var(--r-sm)",
                    fontSize: "14px",
                  }}
                />
              )}
            </label>
          ))}

          {message && (
            <p className={`message ${message.type === "success" ? "message-success" : "message-error"}`}>
              {message.text}
            </p>
          )}

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "保存中..." : "保存する"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
