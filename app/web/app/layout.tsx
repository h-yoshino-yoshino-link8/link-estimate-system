import Link from "next/link";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LinK Estimate OS",
  description: "経営・見積・会計を案件軸でつなぐ業務OS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden>
                ∞
              </span>
              <span className="brand-text">LinK</span>
            </Link>
            <nav className="top-nav" aria-label="primary">
              <Link href="/">経営ダッシュボード</Link>
              <Link href="/projects">案件管理</Link>
              <Link href="/finance">会計センター</Link>
            </nav>
          </div>
        </header>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
