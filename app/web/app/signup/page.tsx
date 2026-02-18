"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";

export default function SignupPage() {
  const [orgName, setOrgName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) { setError("会社名を入力してください"); return; }
    if (!displayName.trim()) { setError("お名前を入力してください"); return; }
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            org_name: orgName.trim(),
            display_name: displayName.trim(),
          },
        },
      });
      if (authError) throw authError;
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1>メールを確認してください</h1>
          <p style={{ textAlign: "center", color: "var(--text-secondary)" }}>
            {email} に確認メールを送信しました。<br />
            メール内のリンクをクリックして登録を完了してください。
          </p>
          <Link href="/login" className="btn btn-primary btn-lg" style={{ width: "100%", textAlign: "center", display: "block", marginTop: 16 }}>
            ログインページへ
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden>∞</span>
          <span className="brand-text">Estimate OS</span>
        </div>
        <h1>新規登録</h1>
        <form onSubmit={handleSignup}>
          <label>
            会社名
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
              autoFocus
              placeholder="株式会社〇〇"
            />
          </label>
          <label>
            お名前
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              placeholder="山田 太郎"
            />
          </label>
          <label>
            メールアドレス
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@company.com"
            />
          </label>
          <label>
            パスワード
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="6文字以上"
            />
          </label>
          {error && <p className="message message-error">{error}</p>}
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: "100%" }}>
            {loading ? "登録中..." : "無料で始める"}
          </button>
        </form>
        <p className="auth-link">
          すでにアカウントをお持ちの方は <Link href="/login">ログイン</Link>
        </p>
      </div>
    </main>
  );
}
