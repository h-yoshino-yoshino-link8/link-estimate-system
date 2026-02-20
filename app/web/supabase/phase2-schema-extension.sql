-- ============================================================
-- Phase 2: スキーマ拡張 — 集計カラム + 月次KPI + トリガー
-- Supabase SQL Editor で実行してください
-- 既存データを破壊しません（ALTER TABLE + デフォルト値）
-- ============================================================

-- 1. projects テーブルに集計カラムを追加
-- 明細変更のたびにメモリ集計していたのをDB側にキャッシュ
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS total_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_selling numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margin numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margin_rate numeric NOT NULL DEFAULT 0;

-- 2. monthly_kpi テーブル新設（月次KPIキャッシュ）
CREATE TABLE IF NOT EXISTS public.monthly_kpi (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year int NOT NULL,
  month int NOT NULL,
  total_sales numeric NOT NULL DEFAULT 0,        -- 月間売上（請求ベース）
  total_cost numeric NOT NULL DEFAULT 0,         -- 月間原価
  gross_profit numeric NOT NULL DEFAULT 0,       -- 粗利
  gross_margin_rate numeric NOT NULL DEFAULT 0,  -- 粗利率(%)
  project_count int NOT NULL DEFAULT 0,          -- 案件数
  invoice_count int NOT NULL DEFAULT 0,          -- 請求件数
  collection_amount numeric NOT NULL DEFAULT 0,  -- 回収額
  receivable_balance numeric NOT NULL DEFAULT 0, -- 月末売掛残
  payable_balance numeric NOT NULL DEFAULT 0,    -- 月末買掛残
  cash_position numeric NOT NULL DEFAULT 0,      -- キャッシュポジション
  dso numeric NOT NULL DEFAULT 0,                -- 売上債権回収日数
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, year, month)
);

ALTER TABLE public.monthly_kpi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_kpi_all" ON public.monthly_kpi
  FOR ALL USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

CREATE INDEX IF NOT EXISTS idx_monthly_kpi_org_year ON public.monthly_kpi(org_id, year);

-- updated_at 自動更新
CREATE TRIGGER trg_monthly_kpi_updated BEFORE UPDATE ON public.monthly_kpi
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. プロジェクト集計の自動更新トリガー
-- project_items が INSERT/UPDATE/DELETE されたら projects の集計カラムを再計算
CREATE OR REPLACE FUNCTION public.update_project_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_project_id uuid;
  cost_sum numeric;
  selling_sum numeric;
  margin_val numeric;
  margin_rate_val numeric;
BEGIN
  -- DELETE の場合は OLD から取得
  IF TG_OP = 'DELETE' THEN
    target_project_id := OLD.project_id;
  ELSE
    target_project_id := NEW.project_id;
  END IF;

  -- 集計
  SELECT
    COALESCE(SUM(cost_price * quantity), 0),
    COALESCE(SUM(selling_price * quantity), 0)
  INTO cost_sum, selling_sum
  FROM public.project_items
  WHERE project_id = target_project_id;

  margin_val := selling_sum - cost_sum;
  margin_rate_val := CASE WHEN selling_sum > 0
    THEN ROUND((margin_val / selling_sum) * 100, 2)
    ELSE 0 END;

  -- projects テーブルを更新
  UPDATE public.projects
  SET
    total_cost = cost_sum,
    total_selling = selling_sum,
    margin = margin_val,
    margin_rate = margin_rate_val
  WHERE id = target_project_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- トリガー設定（INSERT, UPDATE, DELETE 全てで発火）
DROP TRIGGER IF EXISTS trg_project_items_summary ON public.project_items;
CREATE TRIGGER trg_project_items_summary
  AFTER INSERT OR UPDATE OR DELETE ON public.project_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_project_summary();

-- 4. 既存データのバックフィル
-- 既に存在する project_items から集計値を一括計算
UPDATE public.projects p
SET
  total_cost = sub.cost_sum,
  total_selling = sub.selling_sum,
  margin = sub.selling_sum - sub.cost_sum,
  margin_rate = CASE WHEN sub.selling_sum > 0
    THEN ROUND(((sub.selling_sum - sub.cost_sum) / sub.selling_sum) * 100, 2)
    ELSE 0 END
FROM (
  SELECT
    project_id,
    COALESCE(SUM(cost_price * quantity), 0) AS cost_sum,
    COALESCE(SUM(selling_price * quantity), 0) AS selling_sum
  FROM public.project_items
  GROUP BY project_id
) sub
WHERE p.id = sub.project_id;

-- 5. payments に cost_price カラム追加（原価追跡用）
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS cost_price numeric NOT NULL DEFAULT 0;
