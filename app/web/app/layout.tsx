"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./globals.css";
import RuntimeModeIndicator from "../components/runtime-mode-indicator";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <html lang="ja">
      <head>
        <title>LinK Estimate OS</title>
        <meta name="description" content="経営・見積・会計を案件軸でつなぐ業務OS" />
      </head>
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
              <Link href="/" className={pathname === "/" ? "is-active" : ""}>
                経営ダッシュボード
              </Link>
              <Link href="/projects" className={pathname.startsWith("/projects") ? "is-active" : ""}>
                案件管理
              </Link>
            </nav>
            <RuntimeModeIndicator />
          </div>
        </header>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
