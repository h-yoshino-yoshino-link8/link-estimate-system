"use client";

import { AuthProvider, useAuth } from "../lib/auth-context";
import Header from "../components/header";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, orgId, loading, isSupabaseMode } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = pathname === "/login" || pathname === "/signup" || pathname.startsWith("/auth/");
  const hasDevBypass = !!process.env.NEXT_PUBLIC_DEV_ORG_ID;

  useEffect(() => {
    if (!isSupabaseMode || loading || hasDevBypass) return;
    if (!user && !isAuthPage) {
      router.replace("/login");
    }
  }, [user, loading, isSupabaseMode, isAuthPage, router, hasDevBypass]);

  if (isSupabaseMode && loading) {
    return (
      <div className="app-shell">
        <main className="page">
          <p style={{ textAlign: "center", padding: 40, color: "var(--c-text-4)" }}>読み込み中...</p>
        </main>
      </div>
    );
  }

  // 開発バイパス: orgIdがあればAuth無しでも通過
  if (isSupabaseMode && !user && !isAuthPage && !hasDevBypass) {
    return null;
  }

  return (
    <>
      {!isAuthPage && <Header />}
      <div className="app-shell">{children}</div>
    </>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>{children}</AuthGuard>
    </AuthProvider>
  );
}
