# Claude Code Handoff Playbook (2026-02-18)

## 1. Claude Code への実行指示（そのまま貼り付け）
```text
あなたは UI/UX と実装品質を同時に担うリードエンジニアです。
対象リポジトリを、業務で使えるレベルまで改善してください。

# リポジトリ / 作業場所
- /Users/yoshinohiroshi/Library/Mobile Documents/iCloud~md~obsidian/Documents/情報オブシディアン/100_Cursor/link-estimate-system
- 現在の共有ブランチ: main
- 最新共有コミット: b383efe（in-page preview + audit log）
- 最新公開URL: https://web-7l87e9evn-h-yoshino-link-8jps-projects.vercel.app

# 最重要目的
「案件1件を開けば、見積→請求→入金→支払→帳票→連絡まで迷わず完了できるUI/UX」にする。
見た目だけでなく、操作完了率を上げる設計にする。

# 参照必須ファイル
- /Users/yoshinohiroshi/Library/Mobile Documents/iCloud~md~obsidian/Documents/情報オブシディアン/100_Cursor/link-estimate-system/AGENTS.md
- /Users/yoshinohiroshi/Library/Mobile Documents/iCloud~md~obsidian/Documents/情報オブシディアン/100_Cursor/link-estimate-system/docs/GLOBAL_UX_FAILURE_RESEARCH_20260218.md
- /Users/yoshinohiroshi/Library/Mobile Documents/iCloud~md~obsidian/Documents/情報オブシディアン/100_Cursor/link-estimate-system/docs/UIUX_REBUILD_EXECUTION_PLAN_20260218.md
- /Users/yoshinohiroshi/Library/Mobile Documents/iCloud~md~obsidian/Documents/情報オブシディアン/100_Cursor/link-estimate-system/docs/DEPLOY_LOG_20260217.md
- /Users/yoshinohiroshi/Library/Mobile Documents/iCloud~md~obsidian/Documents/情報オブシディアン/100_Cursor/link-estimate-system/docs/EXECUTION_LOG_20260217.md

# 直してほしい対象
1) /projects（案件作成画面）
- 必須入力・エラー表示を明確化
- 保存成功/失敗の状態を明示
- 一覧の可読性向上（案件を選びやすく）

2) /projects/[projectId]（案件コックピット）
- 3カラム構成をさらに実務向けに整理
- ボタン優先順位の明確化（主ボタン1つ、補助ボタンは副次）
- KPIの意味が一目で分かるラベルに統一
- 「今どこで詰まっているか」がわかる導線改善
- 帳票プレビュー枠の使いやすさ改善
- 監査ログの可読性改善（時系列、カテゴリ、内容）

3) 帳票周り
- A4横のプレビュー体験を安定
- 出力失敗時のユーザー向けメッセージを改善

# 実装制約（厳守）
- 既存機能を壊さない（案件作成、明細追加、請求/入金、支払、PDF、メール）
- ローカルモード挙動を維持
- API未接続時でも業務継続できること
- 無駄な大型依存追加は避ける
- build を必ず通す

# 受入条件
- npm --prefix app/web run build が PASS
- /projects で案件作成して /projects/[id] へ遷移できる
- KPIが操作後に反映される
- 見積PDF・領収書PDFが出力/プレビューできる
- 操作順が UI から理解できる
- デプロイ後 URL が 200 を返す

# 実行手順（この順で）
1. issue再現
2. 実装
3. npm --prefix app/web run build
4. git add/commit/push（mainへ共有）
5. cd app/web && npx vercel deploy --prod --yes
6. curl -I -L <deploy-url> で HTTP 200 確認
7. 以下ログ2本を追記して再コミット・再push
   - docs/DEPLOY_LOG_20260217.md
   - docs/EXECUTION_LOG_20260217.md

# 完了時に必ず提出するもの
- 変更ファイル一覧
- コミットID一覧
- デプロイURL
- 残課題（あれば）
- Codexへ戻す引き継ぎ文（下のテンプレート形式）
```

## 2. Claude Code → Codex 戻しテンプレート
```text
# Handover to Codex

## 1. Git
- Branch:
- Base commit:
- New commits:
- Push status:
- PR/merge status:

## 2. What changed
- UI/UX decisions:
- Why these changes:
- Affected user flow:

## 3. Files changed (absolute path)
-
-
-

## 4. Validation
- Build command/result:
- Manual test scenarios/result:
  - project create:
  - estimate item add:
  - invoice create/update:
  - payment create/update:
  - estimate pdf:
  - receipt pdf:
  - mail draft:

## 5. Deploy
- Production URL:
- HTTP check result:

## 6. Logs updated
- docs/DEPLOY_LOG_20260217.md updated: yes/no
- docs/EXECUTION_LOG_20260217.md updated: yes/no

## 7. Risks / TODO
- Open issues:
- Suggested next 3 tasks:
```

## 3. このファイルの使い方
- Claude Code に渡すときは「1. 実行指示」を丸ごと貼る。
- 作業完了後は「2. 戻しテンプレート」を埋めて提出してもらう。
- 受領後、Codex が差分検証・仕上げ・次デプロイを実施する。
