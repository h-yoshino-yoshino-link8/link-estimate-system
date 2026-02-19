# LinK Estimate OS — 引き継ぎドキュメント

> 最終更新: 2026-02-19
> ブランチ: `phase1/supabase-migration`
> コードレビュー完了: Critical/High バグ7件修正済み

---

## 重要ルール（最優先で守ること）

### 認証（ログイン）は最後に設定・テストする

**ログイン機能の設定・テストに時間がかかる場合は、システムが完全にできてから最終的に設定・テストしてください。**

理由:
- Supabase Authのメール送信レート制限（無料プラン: 1時間3〜4通）でテストがブロックされる
- `example.com` ドメインのメールはSupabaseが拒否する
- 認証テストで開発が止まると非効率

開発中の推奨:
- 認証をスキップして機能開発を進める
- CRUD・PDF・UI等の開発を先に完成させる
- 認証は全機能完成後にまとめて設定・テストする

### Node.js バージョン

**必ず Node 20 を使用すること。**

```bash
source ~/.nvm/nvm.sh && nvm use 20
```

- `.nvmrc` に `20` を設定済み
- Node 25 で `npm install` すると Next.js 15 が `VAR_ORIGINAL_PATHNAME` エラーで全滅する
- `node_modules` が壊れた場合: `rm -rf node_modules .next && nvm use 20 && npm install`

---

## プロジェクト概要

**LinK Estimate OS** — 経営・見積・会計を案件軸でつなぐ業務OS

- フレームワーク: Next.js 15.5.10 + React 19
- DB + 認証: Supabase (PostgreSQL + Auth + RLS)
- PDF生成: html2pdf.js（クライアントサイド）
- デプロイ: Vercel
- 言語: TypeScript

---

## 現在の状態（Phase 1: SaaS基盤構築）

### 完了済み
| 項目 | 状態 | 詳細 |
|------|------|------|
| Supabase DB スキーマ | 完了 | 10テーブル + RLS + トリガー（schema.sql） |
| 認証ページ | 完了 | login, signup, auth/callback |
| ミドルウェア | 完了 | 未認証→/login リダイレクト |
| AuthGuard | 完了 | クライアント側の二重防御 |
| Supabase CRUD | 完了 | 22関数（supabase-ops.ts） |
| シードデータ | 完了 | work_items 60+項目, templates 12個（seed.ts） |
| PDF出力 | 完了 | html2pdf.js でダウンロード |
| localStorage削除 | 完了 | Supabase完全移行 |
| GitHubプッシュ | 完了 | phase1/supabase-migration ブランチ |

### 未完了（要対応）
| 項目 | 状態 | 詳細 |
|------|------|------|
| Vercel本番デプロイ | 未実施 | デプロイ上限(100回/日)のため保留中 |
| 認証E2Eテスト | 未実施 | 上記「重要ルール」参照 |
| mainブランチマージ | 未実施 | 全テスト完了後 |

---

## ファイル構成

### 新規作成ファイル（10個）
```
lib/supabase/client.ts      — ブラウザ用Supabaseクライアント
lib/supabase/server.ts      — サーバー用Supabaseクライアント
middleware.ts                — 認証ミドルウェア
app/login/page.tsx           — ログインページ
app/signup/page.tsx          — 新規登録ページ
app/auth/callback/route.ts   — 認証コールバック
lib/auth-context.tsx         — AuthProvider + useAuth
lib/api/types.ts             — 型定義
lib/api/supabase-ops.ts      — Supabase CRUD全22関数
lib/api/seed.ts              — 新規組織シードデータ
```

### 変更ファイル
```
lib/api.ts                   — localStorage削除、Supabase分岐
app/layout.tsx               — サーバーコンポーネント化
app/providers.tsx             — AuthGuard + Providers
components/header.tsx         — ログアウト + 組織名表示
app/projects/[projectId]/page.tsx — PDF出力をhtml2pdf.jsに変更
```

### 削除ファイル
```
components/runtime-mode-indicator.tsx — 不要になったモード切替UI
```

---

## 環境変数

### .env.local（ローカル開発）
```
NEXT_PUBLIC_SUPABASE_URL=https://igggyjfptwxeddkkbzvz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_zBCqbcwobXGmVJJNzsEq9A_4P6ebhYO
NEXT_PUBLIC_DATA_SOURCE=supabase
```

### Vercel環境変数（3環境: Production / Preview / Development）
同じ3変数を設定済み。

### DB直接接続（テスト・デバッグ用）
```
Host: db.igggyjfptwxeddkkbzvz.supabase.co
Port: 5432
Database: postgres
User: postgres
Password: rpm_paf_enh-TWZ4cvy
SSL: { rejectUnauthorized: false }
```

---

## テスト用アカウント

| メール | パスワード | 組織名 | 備考 |
|--------|-----------|--------|------|
| test@link8reform.com | TestPass123! | テスト建設株式会社 | DB直接作成。email_confirmed_at設定済み |

---

## 既知の問題と対策

### 1. VAR_ORIGINAL_PATHNAME エラー
- 原因: Node 25でインストールしたnode_modulesがNext.js 15と互換性なし
- 対策: `.nvmrc`でNode 20固定。`rm -rf node_modules .next && npm install`

### 2. Vercelキャッシュが認証を迂回
- 原因: 静的ページがキャッシュされ、ミドルウェアを通過しない
- 対策: AuthGuard（クライアント側）を二重防御として追加済み

### 3. Supabase メール送信レート制限
- 原因: 無料プランの制限（1時間3〜4通）
- 対策: テスト用ユーザーはDB直接作成で対応。認証テストは最後にまとめて実施

### 4. Vercel デプロイ上限
- 原因: 無料プラン100回/日（ローリング24時間）
- 対策: ローカルビルド確認後にデプロイ。無駄なデプロイを避ける

---

## 開発手順

```bash
# 1. Node 20 に切り替え
source ~/.nvm/nvm.sh && nvm use 20

# 2. プロジェクトディレクトリに移動
cd "/Users/yoshinohiroshi/Library/Mobile Documents/iCloud~md~obsidian/Documents/情報オブシディアン/100_Cursor/link-estimate-system/app/web"

# 3. 依存関係インストール（初回のみ）
npm install

# 4. 開発サーバー起動
npm run dev

# 5. ビルド確認
npx next build

# 6. Vercelデプロイ
npx vercel deploy --prod --yes
```

---

## Git ブランチ戦略

- `main` — 安定版（Phase 1 マージ前の状態）
- `phase1/supabase-migration` — Phase 1 作業ブランチ（現在のHEAD）
- マージ手順: 全テスト完了後 `git checkout main && git merge phase1/supabase-migration`
