"use client";

import { useEffect, useState } from "react";
import { isLocalModeEnabled, onLocalModeChanged } from "../lib/api";

export default function RuntimeModeIndicator() {
  const [isLocal, setIsLocal] = useState<boolean | null>(null);

  useEffect(() => {
    const refresh = () => setIsLocal(isLocalModeEnabled());
    refresh();
    const unsubscribe = onLocalModeChanged(refresh);
    window.addEventListener("focus", refresh);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", refresh);
    };
  }, []);

  if (isLocal === null) {
    return <span className="runtime-badge" style={{ opacity: 0.5 }}>確認中...</span>;
  }

  return (
    <span className={`runtime-badge ${isLocal ? "runtime-badge-local" : "runtime-badge-remote"}`}>
      {isLocal ? "ローカルモード" : "API接続中"}
    </span>
  );
}
