import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "Estimate OS",
  description: "経営・見積・会計を案件軸でつなぐ業務OS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
