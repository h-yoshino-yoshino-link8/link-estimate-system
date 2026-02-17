# Link Estimate Delivery Rules

## Project Goal
- Build a remodeling estimate/cost/invoice/payment cockpit that is usable by sales, back office, and management.
- Keep operation centered on one project record.

## Non-Negotiables
1. No deploy without `npm --prefix app/web run build` success.
2. No deploy without updating both logs:
   - `docs/DEPLOY_LOG_20260217.md`
   - `docs/EXECUTION_LOG_20260217.md`
3. Keep PDF output readable. If API PDF fails, local fallback must still produce valid PDF bytes.
4. Make primary actions explicit in Japanese labels (保存/登録/反映/出力).
5. Avoid hidden steps: show next action guidance in project workspace.

## Standard Execution Flow
1. Reproduce issue
2. Patch code
3. Build
4. Commit + push main
5. Deploy (`npx vercel deploy --prod --yes` in `app/web`)
6. HTTP 200 check by curl
7. Log update commit + push

## Current Priority Order
1. Project creation reliability
2. PDF reliability and A4 landscape requirement
3. KPI correctness and workflow visibility
4. UI simplification toward one-project cockpit

## Useful Paths
- Repo: `/Users/yoshinohiroshi/Library/Mobile Documents/iCloud~md~obsidian/Documents/情報オブシディアン/100_Cursor/link-estimate-system`
- Web app: `app/web`
- Research baseline: `docs/GLOBAL_UX_FAILURE_RESEARCH_20260218.md`
- Rebuild plan: `docs/UIUX_REBUILD_EXECUTION_PLAN_20260218.md`
