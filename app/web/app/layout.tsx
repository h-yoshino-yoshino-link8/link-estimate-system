import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LinK Estimate Panel",
  description: "案件作成と帳票PDF出力の操作パネル",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
