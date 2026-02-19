"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "../lib/auth-context";

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { orgName, displayName, isSupabaseMode, signOut } = useAuth();

  const brandText = orgName || "Estimate OS";

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden>
            ∞
          </span>
          <span className="brand-text">{brandText}</span>
        </Link>
        <nav className="top-nav" aria-label="primary">
          <Link href="/" className={pathname === "/" ? "is-active" : ""}>
            ダッシュボード
          </Link>
          <Link href="/projects" className={pathname.startsWith("/projects") ? "is-active" : ""}>
            案件
          </Link>
          <Link href="/customers" className={pathname.startsWith("/customers") ? "is-active" : ""}>
            顧客
          </Link>
          <Link href="/vendors" className={pathname.startsWith("/vendors") ? "is-active" : ""}>
            仕入先
          </Link>
          <Link href="/work-items" className={pathname.startsWith("/work-items") ? "is-active" : ""}>
            単価表
          </Link>
          <Link href="/settings" className={pathname === "/settings" ? "is-active" : ""}>
            設定
          </Link>
        </nav>
        <div className="topbar-actions">
          {isSupabaseMode && displayName && (
            <span className="topbar-user">{displayName}</span>
          )}
          {isSupabaseMode && (
            <button className="btn-text" onClick={() => void signOut()}>
              ログアウト
            </button>
          )}
        </div>
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="メニュー"
        >
          <span className="hamburger-icon" />
        </button>
      </div>
      {mobileMenuOpen && (
        <nav className="mobile-nav" aria-label="mobile">
          <Link
            href="/"
            className={pathname === "/" ? "is-active" : ""}
            onClick={() => setMobileMenuOpen(false)}
          >
            ダッシュボード
          </Link>
          <Link
            href="/projects"
            className={pathname.startsWith("/projects") ? "is-active" : ""}
            onClick={() => setMobileMenuOpen(false)}
          >
            案件
          </Link>
          <Link
            href="/customers"
            className={pathname.startsWith("/customers") ? "is-active" : ""}
            onClick={() => setMobileMenuOpen(false)}
          >
            顧客
          </Link>
          <Link
            href="/vendors"
            className={pathname.startsWith("/vendors") ? "is-active" : ""}
            onClick={() => setMobileMenuOpen(false)}
          >
            仕入先
          </Link>
          <Link
            href="/work-items"
            className={pathname.startsWith("/work-items") ? "is-active" : ""}
            onClick={() => setMobileMenuOpen(false)}
          >
            単価表
          </Link>
          <Link
            href="/settings"
            className={pathname === "/settings" ? "is-active" : ""}
            onClick={() => setMobileMenuOpen(false)}
          >
            設定
          </Link>
          {isSupabaseMode && (
            <button
              className="btn-text"
              onClick={() => { setMobileMenuOpen(false); void signOut(); }}
            >
              ログアウト
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
