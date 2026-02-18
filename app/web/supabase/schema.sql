-- ============================================================
-- LinK Estimate OS — Supabase Schema
-- マルチテナントSaaS基盤（RLS付き）
-- Supabase SQL Editor で実行してください
-- ============================================================

-- 0. ヘルパー関数: 現在のユーザーの org_id を取得
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid()
$$;

-- ============================================================
-- 1. organizations — 会社情報
-- ============================================================
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  postal_code text DEFAULT '',
  address text DEFAULT '',
  phone text DEFAULT '',
  fax text DEFAULT '',
  email text DEFAULT '',
  invoice_number text DEFAULT '',        -- インボイス登録番号 (T501...)
  bank_info text DEFAULT '',             -- 振込先情報
  logo_url text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select" ON public.organizations
  FOR SELECT USING (id = public.get_user_org_id());
CREATE POLICY "org_update" ON public.organizations
  FOR UPDATE USING (id = public.get_user_org_id());

-- ============================================================
-- 2. profiles — ユーザー ↔ 組織
-- ============================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'admin',    -- admin | member
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- 3. customers — 顧客マスタ
-- ============================================================
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  contact_name text,
  phone text,
  monthly_volume text,
  status text NOT NULL DEFAULT 'アクティブ',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_all" ON public.customers
  FOR ALL USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

CREATE INDEX idx_customers_org ON public.customers(org_id);

-- ============================================================
-- 4. vendors — 協力会社・仕入先
-- ============================================================
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vendor_name text NOT NULL,
  vendor_type text NOT NULL DEFAULT 'subcontractor', -- subcontractor | supplier
  specialty text,
  annual_order_amount numeric NOT NULL DEFAULT 0,
  markup_rate numeric,
  phone text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendors_all" ON public.vendors
  FOR ALL USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

CREATE INDEX idx_vendors_org ON public.vendors(org_id);

-- ============================================================
-- 5. work_items — 工事項目マスタ（単価表）
-- ============================================================
CREATE TABLE public.work_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category text NOT NULL,
  item_name text NOT NULL,
  specification text,
  unit text NOT NULL DEFAULT '式',
  cost_price numeric NOT NULL DEFAULT 0,
  selling_price numeric NOT NULL DEFAULT 0,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_items_all" ON public.work_items
  FOR ALL USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

CREATE INDEX idx_work_items_org ON public.work_items(org_id);

-- ============================================================
-- 6. projects — 案件
-- ============================================================
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT '未設定',
  project_name text NOT NULL,
  site_address text,
  owner_name text NOT NULL DEFAULT '',
  project_status text NOT NULL DEFAULT '見積中',
  estimated_start date,
  estimated_end date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_all" ON public.projects
  FOR ALL USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

CREATE INDEX idx_projects_org ON public.projects(org_id);
CREATE INDEX idx_projects_status ON public.projects(org_id, project_status);

-- ============================================================
-- 7. project_items — 見積明細行
-- ============================================================
CREATE TABLE public.project_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'その他',
  item_name text NOT NULL,
  specification text,
  unit text NOT NULL DEFAULT '式',
  quantity numeric NOT NULL DEFAULT 1,
  cost_price numeric NOT NULL DEFAULT 0,
  selling_price numeric NOT NULL DEFAULT 0,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_items_all" ON public.project_items
  FOR ALL USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

CREATE INDEX idx_project_items_project ON public.project_items(project_id);
CREATE INDEX idx_project_items_org ON public.project_items(org_id);

-- ============================================================
-- 8. invoices — 請求
-- ============================================================
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  invoice_amount numeric NOT NULL DEFAULT 0,
  billed_at date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL DEFAULT (CURRENT_DATE + 30),
  paid_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT '未入金',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_all" ON public.invoices
  FOR ALL USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

CREATE INDEX idx_invoices_project ON public.invoices(project_id);
CREATE INDEX idx_invoices_org ON public.invoices(org_id);

-- ============================================================
-- 9. payments — 支払
-- ============================================================
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_name text NOT NULL DEFAULT '未設定',
  work_description text,
  ordered_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT '未支払',
  paid_at date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_all" ON public.payments
  FOR ALL USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

CREATE INDEX idx_payments_project ON public.payments(project_id);
CREATE INDEX idx_payments_org ON public.payments(org_id);

-- ============================================================
-- 10. estimate_templates — 見積テンプレート
-- ============================================================
CREATE TABLE public.estimate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  keywords text[] NOT NULL DEFAULT '{}',
  items jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.estimate_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_all" ON public.estimate_templates
  FOR ALL USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

CREATE INDEX idx_templates_org ON public.estimate_templates(org_id);

-- ============================================================
-- 自動トリガー: ユーザー登録時に organization + profile 自動作成
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_org_id uuid;
  raw_meta jsonb;
  org_name text;
  user_name text;
BEGIN
  raw_meta := NEW.raw_user_meta_data;
  org_name := COALESCE(raw_meta->>'org_name', '');
  user_name := COALESCE(raw_meta->>'display_name', '');

  -- 組織作成
  INSERT INTO public.organizations (name)
  VALUES (org_name)
  RETURNING id INTO new_org_id;

  -- プロフィール作成
  INSERT INTO public.profiles (id, org_id, display_name, role)
  VALUES (NEW.id, new_org_id, user_name, 'admin');

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- updated_at 自動更新トリガー
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_vendors_updated BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_work_items_updated BEFORE UPDATE ON public.work_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_project_items_updated BEFORE UPDATE ON public.project_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_templates_updated BEFORE UPDATE ON public.estimate_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
