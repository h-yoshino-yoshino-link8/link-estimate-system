# Deployment Guide (Personal)

対象リポジトリ:
- [h-yoshino-yoshino-link8/link-estimate-system](https://github.com/h-yoshino-yoshino-link8/link-estimate-system)

## 1. One-time setup (Render)

1. Render にログイン
2. `New +` -> `Blueprint`
3. このリポジトリを選択して `render.yaml` を読み込み
4. 次の3サービスが作成されることを確認
- `link-estimate-api` (FastAPI)
- `link-estimate-web` (Next.js)
- `link-estimate-db` (PostgreSQL)
5. デプロイ完了後、`link-estimate-web` のURLにアクセスして画面が表示されることを確認

## 2. Runtime behavior

- Web は Next.js rewrite 経由で API を呼ぶ
- ブラウザ側の `NEXT_PUBLIC_API_BASE` は空文字運用
- Excel同期は公開環境ではアップロードAPIを使用
  - `POST /api/v1/sync/excel/upload`

## 3. GitHub Actions

追加済みワークフロー:
- `.github/workflows/ci.yml`
  - push / PR で API test + Web build
- `.github/workflows/deploy-render.yml`
  - `main` push で Render Deploy Hook を実行（シークレット設定時）

### 3.1 Required secrets (GitHub repository settings)

`Settings` -> `Secrets and variables` -> `Actions` に以下を登録:

- `RENDER_API_DEPLOY_HOOK_URL`
- `RENDER_WEB_DEPLOY_HOOK_URL`
- `DEPLOY_API_HEALTH_URL` (例: `https://link-estimate-api.onrender.com/health`)
- `DEPLOY_WEB_HEALTH_URL` (例: `https://link-estimate-web.onrender.com/`)

## 4. Local operational scripts

### 4.1 Check + log

```bash
scripts/check_and_log.sh
```

出力:
- `docs/EXECUTION_LOG_YYYYMMDD.md`

### 4.2 Commit + push (+ optional deploy check)

```bash
scripts/commit_and_push.sh "message"
```

環境変数に Deploy Hook/Health URL が設定されていれば、push後に次も実行:
- `scripts/deploy_and_log.sh`

出力:
- `docs/DEPLOY_LOG_YYYYMMDD.md`
