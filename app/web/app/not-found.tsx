import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page" style={{ textAlign: "center", padding: 80 }}>
      <h1>404</h1>
      <p>ページが見つかりません</p>
      <Link href="/" className="btn btn-primary" style={{ marginTop: 20, display: "inline-block" }}>
        ホームに戻る
      </Link>
    </main>
  );
}
