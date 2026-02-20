"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FinancePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return (
    <main className="page">
      <div className="card" style={{ textAlign: "center", padding: 48 }}>
        <p className="text-muted">経営ダッシュボードへ移動しています...</p>
      </div>
    </main>
  );
}
