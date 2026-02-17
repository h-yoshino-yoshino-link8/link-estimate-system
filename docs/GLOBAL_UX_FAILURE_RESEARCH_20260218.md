# Global Research: Remodeling Estimate Software Failures (2026-02-18)

## 1. 調査目的
- 対象: リフォーム見積・原価・請求・入金・帳票を扱う業務システム
- 目的: 「なぜ失敗するか」を先に把握し、UI/UXを業務起点で再設計する
- 調査日: 2026-02-18 (JST)

## 2. マルチエージェント分担（実行）
- Agent A (Market/Failure): 世界の失敗要因・クレーム要因を調査
- Agent B (Product Gap): 現行画面とのギャップ分析
- Agent C (Execution): 先行修正（PDF・作成導線・KPI反映）実装

## 3. 世界調査で出た主要失敗パターン

### F1. データ断絶で現場と経営の数値がズレる
- 施工業界では、データ分断・連携不足が再作業や非効率を生みやすい。
- 結果: 見積・請求・原価の整合が崩れ、粗利管理が遅れる。
- 参照:
  - Autodesk: https://www.autodesk.com/design-make/articles/report-construction-disconnected-data
  - McKinsey (E&C): https://www.mckinsey.com/industries/engineering-construction-and-building-materials/our-insights/the-next-normal-in-construction-how-disruption-is-reshaping-the-worlds-largest-ecosystem
  - KPMG Global Construction Survey: https://kpmg.com/xx/en/our-insights/gms/the-fluid-state-of-construction-and-infrastructure.html

### F2. 「次に何をすべきか」が画面に出ない
- 公的UXガイドラインでは、ユーザーニーズ起点・最小手順・明確な次アクションが必須。
- 結果: 入力漏れ、操作ミス、教育コスト増。
- 参照:
  - GOV.UK Service Manual (Start with user needs): https://www.gov.uk/service-manual/design/start-with-user-needs
  - USWDS Design Principles: https://designsystem.digital.gov/design-principles/

### F3. 帳票（PDF）品質が壊れると一気に信頼を失う
- 帳票が読めない・印刷できない問題は業務停止に直結。
- 結果: 手戻り、紙運用逆戻り、システム不信。
- 参照:
  - CSS @page size (A4/landscapeの規定): https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@page/size

### F4. リフォーム業界は請求・契約トラブルが生じやすい
- 政府系消費者保護情報でも、リフォーム契約・請求関連の被害/苦情は継続的に注意喚起。
- 結果: 見積の説明不足、変更管理不足、請求根拠の不透明化。
- 参照:
  - FTC Home Improvement and Repair Scams: https://www.ftc.gov/news-events/topics/consumer-scams/home-improvement-and-repair-scams
  - NSW Fair Trading (home building complaints): https://www.fairtrading.nsw.gov.au/housing-and-property/building-and-renovating/complaints-about-home-building-work

### F5. 実務ユーザーの不満は「多機能より操作負荷」
- レビューサイトでは、建設業SaaSに対し「機能は多いが操作が重い/複雑」という不満が繰り返し見られる。
- 結果: 現場定着しない、Excel逆戻り、二重入力。
- 参照:
  - G2 Procore Reviews: https://www.g2.com/products/procore/reviews
  - Capterra Buildertrend Reviews: https://www.capterra.com/p/129167/Buildertrend/reviews/

### F6. 見積精度不足が利益毀損を拡大させる
- 見積時点の抜け漏れ・変更管理不全は、工期遅延と利益率低下に直結しやすい。
- 結果: 後工程（請求/回収）での修正コスト増、顧客不信増。
- 参照:
  - World Bank（Construction productivity context）: https://www.worldbank.org/en/topic/infrastructure/publication/the-global-infrastructure-productivity-gap
  - 建設コスト超過研究（参照ハブ）: https://www.researchgate.net/publication/251238513_What_Causes_Cost_Overrun_in_Construction_Projects

## 3.1 地域別に見える共通懸念
- 北米: 契約・請求・消費者保護の観点で、見積根拠・変更履歴の不足が紛争化しやすい。
- 欧州: 生産性・デジタル化の観点で、分断データ/手作業連携の限界が課題。
- APAC: 工期遅延/コスト超過への感度が高く、見積→実行→請求の連動性が重視される。
- 共通項: 「多機能」より「業務完了まで迷わない導線」の方が定着に効く。

## 4. 吉野さん要件との照合
- 要件: 「1案件中心で、見積→請求→入金→支払→帳票→連絡が連動」
- 評価: 妥当。業務導線として正しい。
- 補正ポイント: 「1画面に全情報を詰める」だけだと認知負荷が高い。
- 採用方針: 1画面コックピット + 次アクション明示 + 段階表示（progressive disclosure）。

## 5. 現行システムに対する批判点（明文化）
1. 操作導線が説明不足で、保存/確定の意味が伝わらない。
2. KPIカードが業務期待値（見積・入金・粗利）とズレる瞬間がある。
3. PDF失敗時の耐障害性が弱かった（今回修正済み）。
4. 「作業完了までの残タスク」が見えない。
5. 案件作成失敗時のエラー説明が弱かった（今回修正済み）。

## 6. 直近で反映した対策（実装済み）
- ローカル/不正レスポンス時でも読めるPDFを生成（A4横、PDF 1.4）
- ローカルモード時の案件作成を安定化
- 案件作成ボタン文言を保存意図が分かる形へ変更
- 案件ワークスペースに「次にやること」バナーとステップ進捗を追加

## 7. 追加の改善提案（次スプリント）
1. 案件コックピットを3列固定にし、請求/支払の操作対象IDを常に見える位置へ固定。
2. 帳票を「プレビュー」「出力」「履歴」の3機能に分離して、失敗時は再生成ボタンを明示。
3. 変更履歴（誰が、いつ、どの金額を変更）を案件単位で表示。
4. 「見積差額警告」（目標粗利率を下回った時）を即時表示。
