# 見積原価管理システム - 株式会社LinK

LinK工務店レスキュー向けの見積・原価管理Excelシステムです。

## 概要

賃貸管理会社からの原状回復・リフォーム・リノベーション工事に対して、見積作成・原価管理・案件管理・請求/支払管理を一元化します。

## リポジトリ構成

```text
link-estimate-system/
├── README.md
├── docs/
│   ├── BUILD_RUNBOOK_20260217.md     # 構築・検証手順
│   ├── 現状分析_20260211.md
│   ├── 設計方針_v4.md
│   └── シート仕様書.md
├── excel/
│   ├── 見積原価管理システム.xlsx      # ソースブック
│   └── 見積原価管理システム.xlsm      # ビルド成果物（macro-enabled）
├── scripts/
│   ├── build_workbook.py             # xlsm生成 + S表紙INDIRECT化
│   └── validate_workbook.py          # 構造/数式/列定義の検証
└── vba/
    └── Module_NewProject.bas         # 新規案件作成 + PDF出力マクロ
```

## ビルド手順

前提:
- macOS
- Microsoft Excel
- Python 3.9+
- `appscript` と `openpyxl` が利用可能

1. `.xlsm` を生成

```bash
python3 scripts/build_workbook.py
```

2. ブック検証

```bash
python3 scripts/validate_workbook.py --workbook excel/見積原価管理システム.xlsm
```

3. VBA必須チェック（厳密）

```bash
python3 scripts/validate_workbook.py --workbook excel/見積原価管理システム.xlsm --require-vba
```

## 手動反映が必要な作業（Excel UI）

`build_workbook.py` は `.xlsm` 化、`Ｓ表紙!I36:I55` の `INDIRECT` 化、旧外部リンク（`[1]Sheet!A1` 形式）の除去まで自動化します。以下はExcel UIで実施してください。

1. `vba/Module_NewProject.bas` をVBEにインポート
2. `操作パネル` に3ボタンを配置しマクロ割当
3. `新規案件作成`, `S表紙PDF出力`, `領収書PDF出力` の実行確認

詳細は `docs/BUILD_RUNBOOK_20260217.md` を参照してください。

## App (MVP) 開発

アプリ実装は `app/` 配下です。

- Backend: `app/api` (FastAPI)
- Frontend: `app/web` (Next.js)

詳細は `app/README.md` を参照してください。

## 進捗確認・ログ・プッシュ運用

毎回の確認とログ生成は次で実行できます。

```bash
scripts/check_and_log.sh
```

ログ出力先:
- `docs/EXECUTION_LOG_YYYYMMDD.md`

確認からコミット・プッシュまで一括実行する場合:

```bash
scripts/commit_and_push.sh "your commit message"
```
