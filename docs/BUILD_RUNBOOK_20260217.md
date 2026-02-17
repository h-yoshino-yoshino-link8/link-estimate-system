# BUILD RUNBOOK (2026-02-17)

## 1. 目的

`見積原価管理システム.xlsx` を運用用 `見積原価管理システム.xlsm` として構築し、以下を満たす。

- `Ｓ表紙!I36:I55` が `INDIRECT` で動的参照
- `案件管理` のA-AD/AE-AF列定義を維持
- 検証スクリプトで構造チェックが再現可能

## 2. 実装内容

### 2.1 VBAモジュール強化

対象: `vba/Module_NewProject.bas`

- 禁則文字サニタイズ追加（シート名/PDFファイル名）
- 案件ID採番を防御的に再実装（`P-XXX`以外を無視）
- 例外時の安全終了処理追加（`ScreenUpdating`復元）
- 受注区分数式を現行シート式に合わせて維持
- 各PDF出力の入力チェックとエラー表示を強化

### 2.2 ビルド/検証スクリプト追加

対象:
- `scripts/build_workbook.py`
- `scripts/validate_workbook.py`

`build_workbook.py`:
- Excel経由で `Ｓ表紙!I36:I55` を `INDIRECT` へ変更
- 旧外部リンク形式（`[1]Sheet!A1`）の内部参照化
- Excelリンクソース（`link_sources`）の切断
- `.xlsx` から `.xlsm` を生成

`validate_workbook.py`:
- 必須45シートの存在確認
- `Ｓ表紙!I36:I55` 数式確認
- `案件管理!A4:AF4` 列ヘッダ確認
- `xl/externalLinks/*` 残存チェック
- `=[n]...` 形式数式の残存チェック
- macro-enabled判定（`--require-vba` で `vbaProject.bin` 必須化）

## 3. 実行手順

```bash
# 1) xlsm生成
python3 scripts/build_workbook.py

# 2) 構造検証（warn許容）
python3 scripts/validate_workbook.py --workbook excel/見積原価管理システム.xlsm

# 3) VBA厳密検証（vbaProject必須）
python3 scripts/validate_workbook.py --workbook excel/見積原価管理システム.xlsm --require-vba
```

## 4. 実行結果

### 4.1 構造検証（warn許容）

- 結果: PASS
- 補足: `vbaProject.bin` 未搭載のため警告あり

### 4.2 VBA厳密検証

- 結果: FAIL
- 理由: `Workbook does not contain vbaProject.bin`

## 5. 手動作業（Excel UI）

`vbaProject.bin` を含む完成状態にするため、以下を手動実施する。

1. `excel/見積原価管理システム.xlsm` をExcelで開く
2. VBEを開き `vba/Module_NewProject.bas` をインポート
3. `操作パネル` にボタンを3つ配置し、下記マクロを割り当て
   - `新規案件作成`
   - `S表紙PDF出力`
   - `領収書PDF出力`
4. 保存後、`--require-vba` 付き検証を再実行してPASSを確認

## 6. 受入チェックリスト

- [x] `excel/見積原価管理システム.xlsm` が生成される
- [x] `Ｓ表紙!I36:I55` が `INDIRECT` 化される
- [x] 外部リンク警告の原因（`externalLinks` / `=[n]`参照）が除去される
- [x] `案件管理` 列定義（A-AD/AE-AF）が維持される
- [x] 検証スクリプトで構造判定が可能
- [ ] `vbaProject.bin` 搭載（手動インポート後）
- [ ] ボタン割当とマクロ動作確認（手動実施）
