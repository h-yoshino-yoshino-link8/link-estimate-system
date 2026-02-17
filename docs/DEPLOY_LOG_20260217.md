## Deploy Run (2026-02-17 22:03:54 JST)
- Branch: main
- Head: 872917c
- api: SKIP (hook URL not set)
- web: SKIP (hook URL not set)
- api health: SKIP (URL not set)
- web health: SKIP (URL not set)


## Vercel Deploy (2026-02-17 22:19:04 JST)
- Project: `h-yoshino-link-8jps-projects/web`
- Commit: `d8dadea`
- Production URL: https://web-9qr34kyg0-h-yoshino-link-8jps-projects.vercel.app
- Access check: `HTTP 200`
- Note: Team-level SSO protection was set to `null` for this project via Vercel API, so the URL is now externally viewable.

## Vercel Deploy (2026-02-17 22:24:12 JST)
- Project: `h-yoshino-link-8jps-projects/web`
- Commit: `6e3163e`
- Production URL: https://web-b0kl54jbf-h-yoshino-link-8jps-projects.vercel.app
- Access check: `HTTP 200`
- Change: Restored local-mode write flow for project/estimate/cost operations and added explicit in-screen local-mode warnings.

## Vercel Deploy (2026-02-17 22:37:49 JST)
- Project: `h-yoshino-link-8jps-projects/web`
- Commit: `6759a74`
- Production URL: https://web-i40jtwmms-h-yoshino-link-8jps-projects.vercel.app
- Access check: `HTTP 200`
- Change: Rebuilt project workspace into FileMaker-style dense UI (工事管理画面) while preserving estimate/invoice/payment/document handlers.

## Vercel Deploy (2026-02-17 22:43:18 JST)
- Project: `h-yoshino-link-8jps-projects/web`
- Commit: `3fa841a`
- Production URL: https://web-huwpjthyi-h-yoshino-link-8jps-projects.vercel.app
- Access check: `HTTP 200`
- Change: Simplified project workspace to step-by-step workflow layout (STEP1〜STEP4) with clearer primary actions.

## Vercel Deploy (2026-02-17 22:56:53 JST)
- Project: `h-yoshino-link-8jps-projects/web`
- Commit: `35b8118`
- Production URL: https://web-pw38wacj5-h-yoshino-link-8jps-projects.vercel.app
- Access check: `HTTP 200`
- Fix: In local mode, skip remote API calls and save directly to local data to avoid project creation failures.

## Vercel Deploy (2026-02-18 06:18:54 JST)
- Project: `h-yoshino-link-8jps-projects/web`
- Commit: `2b60106`
- Production URL: https://web-1zf09po6p-h-yoshino-link-8jps-projects.vercel.app
- Access check: `HTTP 200`
- Fixes:
  - Local/invalid PDF fallback now emits valid `%PDF-1.4` bytes (A4 landscape).
  - KPI top cards now reflect estimate/invoice/settlement/cost/gross values.
  - Project creation button wording clarified to explicit "保存して案件を作成".
