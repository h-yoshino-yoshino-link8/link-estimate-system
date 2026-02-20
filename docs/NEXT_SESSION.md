# 次のセッション引き継ぎ
以下をそのまま新しいターミナルに貼ってください:
---
cd "/Users/yoshinohiroshi/Library/Mobile Documents/iCloud~md~obsidian/Documents/情報オブシディアン/100_Cursor/link-estimate-system" && claude
---
Claude起動後:
---
docs/NEXT_SESSION.md を読んで引き継ぎ。Phase 2を即開始。
---

## 状況（3行）
- Phase 0-1完了。main + phase1をGitHub push済み。Vercel本番デプロイ済み（https://web-nine-blond-14.vercel.app）
- 戦略プラン承認済み（docs/STRATEGIC_PLAN_20260220.md）。段階的強化10日間プラン
- 次はPhase 2: スキーマ拡張+銀行ダッシュボード（3日間）

## 次にやること（Phase 2）
1. **スキーマ拡張**: projectsに集計カラム追加（total_cost, total_selling, margin, margin_rate）+ monthly_kpiテーブル新設 + project_summary自動更新トリガー
2. **ダッシュボード高速化**: sbGetDashboardOverview()のメモリ集計 → DB集計キャッシュに切り替え
3. **銀行融資指標追加**: 月次粗利率トレンド、DSO（売上債権回収日数）、キャッシュポジション推移 + house-osからerror-handler.ts移植

## 注意事項
- **プロジェクトパス**: `情報オブシディアン/100_Cursor/link-estimate-system/app/web/`（~/Dev/ではない！）
- **Node.js**: 必ず `source ~/.nvm/nvm.sh && nvm use 20` してから作業
- **ブランチ**: 現在mainにいる。feature/phase2-schema-extensionを切って作業
- **Supabase**: schema.sqlの変更はALTER TABLEで安全に。既存データ破壊禁止
- **デプロイ上限**: Vercel無料プラン100回/日。ローカルビルド確認してからデプロイ
- **戦略プラン全文**: docs/STRATEGIC_PLAN_20260220.md
- **メモリファイル**: ~/.claude/projects/-Users-yoshinohiroshi/memory/link-estimate-system.md
