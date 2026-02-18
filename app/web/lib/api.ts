// ============================================================
// LinK Estimate OS — Data Layer v3 (Complete Rebuild)
// 原価・売値・粗利を全項目に。実データでシード。
// ============================================================

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");
const API_KEY = (process.env.NEXT_PUBLIC_APP_API_KEY ?? "").trim();
const FORCE_LOCAL_DATA = process.env.NEXT_PUBLIC_FORCE_LOCAL_DATA === "1";
const LOCAL_DB_KEY = "link_estimate_local_db_v3";
const LOCAL_MODE_KEY = "link_estimate_local_mode_enabled";
const LOCAL_MODE_EVENT = "link_estimate_local_mode_change";

// ============================================================
// Types
// ============================================================

export type Customer = {
  customer_id: string;
  customer_name: string;
  contact_name?: string | null;
  phone?: string | null;
  monthly_volume?: string | null;  // 月間取引規模の目安
  status: string;
};

export type Vendor = {
  vendor_id: string;
  vendor_name: string;
  vendor_type: "subcontractor" | "supplier";  // 外注先 or 仕入先
  specialty?: string | null;       // 専門分野
  annual_order_amount: number;     // 年間発注額
  markup_rate?: number | null;     // 掛け率
  phone?: string | null;
  note?: string | null;
};

export type WorkItemMaster = {
  id: number;
  category: string;
  item_name: string;
  specification?: string | null;
  unit: string;
  cost_price: number;     // 原価（仕入値）
  selling_price: number;  // 売値（お客様提示価格）
  vendor_id?: string | null;  // デフォルト仕入先
};

export type Project = {
  project_id: string;
  customer_id: string;
  customer_name: string;
  project_name: string;
  site_address?: string | null;
  owner_name: string;
  project_status: string;
  created_at: string;
  estimated_start?: string | null;
  estimated_end?: string | null;
  note?: string | null;
};

export type ProjectItem = {
  id: number;
  project_id: string;
  category: string;
  item_name: string;
  specification?: string | null;
  unit: string;
  quantity: number;
  cost_price: number;      // 原価単価
  selling_price: number;   // 売値単価
  vendor_id?: string | null;
};

export type Invoice = {
  invoice_id: string;
  project_id: string;
  invoice_amount: number;
  billed_at: string;
  due_date: string;
  paid_amount: number;
  remaining_amount: number;
  status: string;
  note?: string | null;
};

export type Payment = {
  payment_id: string;
  project_id: string;
  vendor_id?: string | null;
  vendor_name: string;
  work_description?: string | null;
  ordered_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
  paid_at?: string | null;
  note?: string | null;
};

export type ProjectListResponse = {
  items: Project[];
  total: number;
};

// Dashboard Types
export type DashboardMonthlySalesPoint = {
  month: string;
  amount: number;
  cost: number;
  margin: number;
};

export type DashboardActiveProject = {
  project_id: string;
  project_name: string;
  customer_name: string;
  project_status: string;
  selling_total: number;
  cost_total: number;
  margin: number;
  margin_rate: number;
  created_at: string;
};

export type DashboardOverview = {
  // 銀行が見たい数字
  current_month_sales: number;
  next_month_projection: number;
  pipeline_total: number;       // 見積中+受注済の合計
  pipeline_count: number;
  ytd_sales: number;
  last_year_ytd_sales: number;
  yoy_growth_rate: number;

  // 資金繰り
  receivable_balance: number;   // 売掛残
  payable_balance: number;      // 買掛残
  cash_position: number;        // 現預金相当（receivable - payable概算）

  // 収益性
  avg_margin_rate: number;      // 平均粗利率
  all_time_sales: number;
  all_time_cost: number;
  all_time_margin: number;

  // 案件
  active_project_count: number;
  status_counts: Record<string, number>;
  monthly_sales: DashboardMonthlySalesPoint[];
  active_projects: DashboardActiveProject[];

  // 仕入先分析
  top_vendors: { vendor_name: string; amount: number; count: number }[];
};

// ============================================================
// Local DB Schema
// ============================================================

type LocalDb = {
  customers: Customer[];
  vendors: Vendor[];
  projects: Project[];
  work_items: WorkItemMaster[];
  project_items: ProjectItem[];
  invoices: Invoice[];
  payments: Payment[];
};

// ============================================================
// Utilities
// ============================================================

function isBrowser() {
  return typeof window !== "undefined";
}

function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function ymd(date = new Date()) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function nextId(values: string[], prefix: string) {
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const v of values) {
    const m = re.exec((v || "").trim());
    if (m) {
      const n = Number(m[1]);
      if (n > max) max = n;
    }
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

// Status helpers
const PROJECT_STATUSES = ["見積中", "受注", "施工中", "完了", "請求済", "入金済", "失注"] as const;
export type ProjectStatus = typeof PROJECT_STATUSES[number];
export { PROJECT_STATUSES };

function invoiceStatus(amount: number, paid: number) {
  if (amount <= 0) return "未請求";
  if (paid >= amount) return "入金済";
  if (paid > 0) return "一部入金";
  return "未入金";
}

function paymentStatus(ordered: number, paid: number) {
  if (ordered <= 0) return "未発注";
  if (paid >= ordered) return "支払済";
  if (paid > 0) return "一部支払";
  return "未支払";
}

// ============================================================
// Seed Data — 実際のLinKビジネスデータ
// ============================================================

function seedLocalDb(): LocalDb {
  const customers: Customer[] = [
    { customer_id: "C-001", customer_name: "矢島不動産管理", contact_name: "矢島様", phone: null, monthly_volume: "主力取引先", status: "アクティブ" },
    { customer_id: "C-002", customer_name: "一建設", contact_name: null, phone: null, monthly_volume: "月500万規模", status: "アクティブ" },
    { customer_id: "C-003", customer_name: "フィガロ", contact_name: null, phone: null, monthly_volume: "備品中心", status: "アクティブ" },
    { customer_id: "C-004", customer_name: "石澤クリーニング", contact_name: "石澤様", phone: null, monthly_volume: "紹介案件", status: "アクティブ" },
  ];

  // 主要仕入先（実データ: 外注発注分析_2026年2月.json）
  const vendors: Vendor[] = [
    // 外注先 TOP10
    { vendor_id: "V-001", vendor_name: "M-Pros", vendor_type: "subcontractor", specialty: "内装全般", annual_order_amount: 7180000, note: "最大外注先" },
    { vendor_id: "V-002", vendor_name: "清水建装", vendor_type: "subcontractor", specialty: "塗装・防水", annual_order_amount: 6530000 },
    { vendor_id: "V-003", vendor_name: "秀英", vendor_type: "subcontractor", specialty: "大工工事", annual_order_amount: 5310000 },
    { vendor_id: "V-004", vendor_name: "ハートフルホーム", vendor_type: "subcontractor", specialty: "クリーニング", annual_order_amount: 4750000 },
    { vendor_id: "V-005", vendor_name: "ELITZ", vendor_type: "subcontractor", specialty: "電気工事", annual_order_amount: 4360000 },
    { vendor_id: "V-006", vendor_name: "大翔", vendor_type: "subcontractor", specialty: "内装工事", annual_order_amount: 3470000 },
    { vendor_id: "V-007", vendor_name: "キツタカ", vendor_type: "subcontractor", specialty: "畳・襖・障子", annual_order_amount: 3130000 },
    { vendor_id: "V-008", vendor_name: "あっくん", vendor_type: "subcontractor", specialty: "塗装", annual_order_amount: 2660000 },
    { vendor_id: "V-009", vendor_name: "吉川塗装店", vendor_type: "subcontractor", specialty: "塗装", annual_order_amount: 2360000 },
    { vendor_id: "V-010", vendor_name: "サンヨーコーポレーション", vendor_type: "subcontractor", specialty: "設備工事", annual_order_amount: 2190000 },
    // 材料仕入先（全9社）
    { vendor_id: "V-101", vendor_name: "ワタナベ", vendor_type: "supplier", specialty: "建材全般", annual_order_amount: 5580000, markup_rate: 0.7, note: "最大材料仕入先(36%)" },
    { vendor_id: "V-102", vendor_name: "渡辺パイプ", vendor_type: "supplier", specialty: "配管・水回り", annual_order_amount: 5040000, markup_rate: 0.65, note: "33%" },
    { vendor_id: "V-103", vendor_name: "角産", vendor_type: "supplier", specialty: "建材", annual_order_amount: 3480000, markup_rate: 0.7, note: "23%" },
    { vendor_id: "V-104", vendor_name: "スミテック", vendor_type: "supplier", specialty: "建材", annual_order_amount: 470000, markup_rate: 0.75 },
    { vendor_id: "V-105", vendor_name: "カインズ", vendor_type: "supplier", specialty: "雑資材", annual_order_amount: 310000, markup_rate: 1.0 },
    { vendor_id: "V-106", vendor_name: "島忠", vendor_type: "supplier", specialty: "雑資材", annual_order_amount: 200000, markup_rate: 1.0 },
    { vendor_id: "V-107", vendor_name: "コーナン", vendor_type: "supplier", specialty: "雑資材", annual_order_amount: 170000, markup_rate: 1.0 },
    { vendor_id: "V-108", vendor_name: "コメリ", vendor_type: "supplier", specialty: "資材", annual_order_amount: 110000, markup_rate: 1.0 },
    { vendor_id: "V-109", vendor_name: "ビバホーム", vendor_type: "supplier", specialty: "雑資材", annual_order_amount: 30000, markup_rate: 1.0 },
  ];

  // 工事項目マスタ（実際の単価ベース）
  const work_items: WorkItemMaster[] = [
    // 畳・襖・障子（キツタカ単価ベース）
    { id: 1, category: "畳・襖", item_name: "畳表替え", unit: "枚", cost_price: 3900, selling_price: 6500, vendor_id: "V-007" },
    { id: 2, category: "畳・襖", item_name: "畳新調", unit: "枚", cost_price: 9500, selling_price: 15000, vendor_id: "V-007" },
    { id: 3, category: "畳・襖", item_name: "襖張替え（両面）", unit: "枚", cost_price: 4000, selling_price: 7000, vendor_id: "V-007" },
    { id: 4, category: "畳・襖", item_name: "障子張替え", unit: "枚", cost_price: 2500, selling_price: 4500, vendor_id: "V-007" },
    { id: 5, category: "畳・襖", item_name: "網戸張替え", unit: "枚", cost_price: 3000, selling_price: 5000, vendor_id: "V-007" },

    // クロス・床（内装工事）
    { id: 10, category: "内装", item_name: "クロス貼替（量産）", unit: "m2", cost_price: 850, selling_price: 1400, vendor_id: "V-001" },
    { id: 11, category: "内装", item_name: "クロス貼替（1000番台）", unit: "m2", cost_price: 1100, selling_price: 1800, vendor_id: "V-001" },
    { id: 12, category: "内装", item_name: "CF貼替", unit: "m2", cost_price: 2800, selling_price: 4500, vendor_id: "V-001" },
    { id: 13, category: "内装", item_name: "フロアタイル貼り", unit: "m2", cost_price: 3500, selling_price: 5500, vendor_id: "V-001" },
    { id: 14, category: "内装", item_name: "巾木交換", unit: "m", cost_price: 600, selling_price: 1000, vendor_id: "V-001" },

    // 塗装
    { id: 20, category: "塗装", item_name: "室内塗装（壁）", unit: "m2", cost_price: 1200, selling_price: 2000, vendor_id: "V-002" },
    { id: 21, category: "塗装", item_name: "外壁塗装", unit: "m2", cost_price: 2500, selling_price: 4200, vendor_id: "V-002" },
    { id: 22, category: "塗装", item_name: "木部塗装", unit: "m2", cost_price: 1800, selling_price: 3000, vendor_id: "V-008" },

    // 設備
    { id: 30, category: "設備", item_name: "トイレ交換", unit: "台", cost_price: 45000, selling_price: 85000, vendor_id: "V-010" },
    { id: 31, category: "設備", item_name: "洗面台交換", unit: "台", cost_price: 35000, selling_price: 65000, vendor_id: "V-010" },
    { id: 32, category: "設備", item_name: "混合水栓交換", unit: "箇所", cost_price: 15000, selling_price: 28000, vendor_id: "V-010" },
    { id: 33, category: "設備", item_name: "給湯器交換", unit: "台", cost_price: 85000, selling_price: 150000, vendor_id: "V-010" },

    // 電気
    { id: 40, category: "電気", item_name: "照明器具交換", unit: "箇所", cost_price: 5000, selling_price: 9000, vendor_id: "V-005" },
    { id: 41, category: "電気", item_name: "コンセント増設", unit: "箇所", cost_price: 8000, selling_price: 15000, vendor_id: "V-005" },
    { id: 42, category: "電気", item_name: "分電盤交換", unit: "台", cost_price: 35000, selling_price: 60000, vendor_id: "V-005" },

    // 大工
    { id: 50, category: "大工", item_name: "床張替え（フローリング）", unit: "m2", cost_price: 6000, selling_price: 9500, vendor_id: "V-003" },
    { id: 51, category: "大工", item_name: "建具調整", unit: "箇所", cost_price: 5000, selling_price: 8000, vendor_id: "V-003" },
    { id: 52, category: "大工", item_name: "棚造作", unit: "箇所", cost_price: 15000, selling_price: 25000, vendor_id: "V-003" },

    // クリーニング
    { id: 60, category: "クリーニング", item_name: "ハウスクリーニング（1K）", unit: "式", cost_price: 22000, selling_price: 35000, vendor_id: "V-004" },
    { id: 61, category: "クリーニング", item_name: "ハウスクリーニング（2DK）", unit: "式", cost_price: 35000, selling_price: 55000, vendor_id: "V-004" },
    { id: 62, category: "クリーニング", item_name: "エアコンクリーニング", unit: "台", cost_price: 8000, selling_price: 15000, vendor_id: "V-004" },

    // 諸経費
    { id: 90, category: "諸経費", item_name: "現場管理費", unit: "式", cost_price: 0, selling_price: 15000 },
    { id: 91, category: "諸経費", item_name: "廃棄物処理", unit: "式", cost_price: 15000, selling_price: 25000 },
    { id: 92, category: "諸経費", item_name: "養生費", unit: "式", cost_price: 5000, selling_price: 10000 },

    // --- 追加項目（ID 100〜） ---

    // 内装追加
    { id: 100, category: "内装", item_name: "ソフト巾木貼替", unit: "m", cost_price: 400, selling_price: 700, vendor_id: "V-001" },
    { id: 101, category: "内装", item_name: "壁紙下地パテ処理", unit: "m2", cost_price: 300, selling_price: 600, vendor_id: "V-001" },
    { id: 102, category: "内装", item_name: "天井クロス貼替（量産）", unit: "m2", cost_price: 900, selling_price: 1500, vendor_id: "V-001" },
    { id: 103, category: "内装", item_name: "アクセントクロス（1000番台）", unit: "m2", cost_price: 1200, selling_price: 2000, vendor_id: "V-001" },
    { id: 104, category: "内装", item_name: "腰壁造作", unit: "m", cost_price: 3000, selling_price: 5000, vendor_id: "V-003" },
    { id: 105, category: "内装", item_name: "カーペット張替え", unit: "m2", cost_price: 3000, selling_price: 5000, vendor_id: "V-001" },
    { id: 106, category: "内装", item_name: "長尺シート貼り", unit: "m2", cost_price: 3500, selling_price: 5800, vendor_id: "V-001" },

    // 水回り追加
    { id: 110, category: "設備", item_name: "シャワー水栓交換", unit: "箇所", cost_price: 12000, selling_price: 22000, vendor_id: "V-010" },
    { id: 111, category: "設備", item_name: "排水管洗浄", unit: "式", cost_price: 8000, selling_price: 15000, vendor_id: "V-010" },
    { id: 112, category: "設備", item_name: "防水工事（浴室）", unit: "式", cost_price: 40000, selling_price: 70000, vendor_id: "V-002" },
    { id: 113, category: "設備", item_name: "キッチン交換（ミニ）", unit: "台", cost_price: 80000, selling_price: 140000, vendor_id: "V-010" },
    { id: 114, category: "設備", item_name: "キッチン交換（システム）", unit: "台", cost_price: 250000, selling_price: 400000, vendor_id: "V-010" },
    { id: 115, category: "設備", item_name: "浴室換気扇交換", unit: "台", cost_price: 8000, selling_price: 15000, vendor_id: "V-005" },
    { id: 116, category: "設備", item_name: "ウォシュレット交換", unit: "台", cost_price: 25000, selling_price: 45000, vendor_id: "V-010" },
    { id: 117, category: "設備", item_name: "排水トラップ交換", unit: "箇所", cost_price: 3000, selling_price: 6000, vendor_id: "V-010" },

    // 建具
    { id: 120, category: "建具", item_name: "室内ドア交換", unit: "枚", cost_price: 20000, selling_price: 35000, vendor_id: "V-003" },
    { id: 121, category: "建具", item_name: "クローゼット扉交換", unit: "枚", cost_price: 15000, selling_price: 28000, vendor_id: "V-003" },
    { id: 122, category: "建具", item_name: "玄関ドア調整", unit: "式", cost_price: 5000, selling_price: 10000, vendor_id: "V-003" },
    { id: 123, category: "建具", item_name: "レバーハンドル交換", unit: "箇所", cost_price: 3000, selling_price: 6000, vendor_id: "V-003" },
    { id: 124, category: "建具", item_name: "ドアクローザー交換", unit: "台", cost_price: 8000, selling_price: 15000, vendor_id: "V-003" },
    { id: 125, category: "建具", item_name: "引戸レール交換", unit: "箇所", cost_price: 5000, selling_price: 9000, vendor_id: "V-003" },

    // 金物・小物
    { id: 130, category: "金物・小物", item_name: "スイッチプレート交換", unit: "箇所", cost_price: 300, selling_price: 800, vendor_id: "V-005" },
    { id: 131, category: "金物・小物", item_name: "カーテンレール取付", unit: "箇所", cost_price: 2000, selling_price: 4500, vendor_id: "V-003" },
    { id: 132, category: "金物・小物", item_name: "タオルバー交換", unit: "箇所", cost_price: 1500, selling_price: 3500, vendor_id: "V-003" },
    { id: 133, category: "金物・小物", item_name: "ペーパーホルダー交換", unit: "箇所", cost_price: 1000, selling_price: 2500, vendor_id: "V-003" },
    { id: 134, category: "金物・小物", item_name: "鏡交換（洗面）", unit: "枚", cost_price: 5000, selling_price: 10000, vendor_id: "V-003" },
    { id: 135, category: "金物・小物", item_name: "物干し金物取付", unit: "箇所", cost_price: 3000, selling_price: 6000, vendor_id: "V-003" },

    // 外装追加
    { id: 140, category: "外装", item_name: "屋根塗装", unit: "m2", cost_price: 2200, selling_price: 3800, vendor_id: "V-002" },
    { id: 141, category: "外装", item_name: "雨樋交換", unit: "m", cost_price: 3000, selling_price: 5500, vendor_id: "V-002" },
    { id: 142, category: "外装", item_name: "シーリング打替え", unit: "m", cost_price: 800, selling_price: 1500, vendor_id: "V-002" },
    { id: 143, category: "外装", item_name: "ベランダ防水", unit: "m2", cost_price: 4000, selling_price: 7000, vendor_id: "V-002" },
    { id: 144, category: "外装", item_name: "外壁部分補修", unit: "m2", cost_price: 3000, selling_price: 5500, vendor_id: "V-002" },

    // 防犯・安全
    { id: 150, category: "防犯・安全", item_name: "鍵交換（シリンダー）", unit: "箇所", cost_price: 8000, selling_price: 15000, vendor_id: "V-003" },
    { id: 151, category: "防犯・安全", item_name: "インターホン交換", unit: "台", cost_price: 12000, selling_price: 22000, vendor_id: "V-005" },
    { id: 152, category: "防犯・安全", item_name: "火災報知器交換", unit: "台", cost_price: 4000, selling_price: 8000, vendor_id: "V-005" },
    { id: 153, category: "防犯・安全", item_name: "手すり取付", unit: "箇所", cost_price: 8000, selling_price: 15000, vendor_id: "V-003" },

    // 解体・撤去
    { id: 160, category: "解体・撤去", item_name: "残置物撤去（1R分）", unit: "式", cost_price: 30000, selling_price: 50000, vendor_id: "V-006" },
    { id: 161, category: "解体・撤去", item_name: "残置物撤去（2DK分）", unit: "式", cost_price: 50000, selling_price: 80000, vendor_id: "V-006" },
    { id: 162, category: "解体・撤去", item_name: "部分解体（壁）", unit: "m2", cost_price: 3000, selling_price: 5500, vendor_id: "V-006" },
    { id: 163, category: "解体・撤去", item_name: "部分解体（床）", unit: "m2", cost_price: 2500, selling_price: 4500, vendor_id: "V-006" },
    { id: 164, category: "解体・撤去", item_name: "エアコン撤去", unit: "台", cost_price: 5000, selling_price: 10000, vendor_id: "V-006" },

    // エアコン・換気
    { id: 170, category: "設備", item_name: "エアコン取付（新規）", unit: "台", cost_price: 15000, selling_price: 28000, vendor_id: "V-005" },
    { id: 171, category: "設備", item_name: "エアコン交換", unit: "台", cost_price: 55000, selling_price: 95000, vendor_id: "V-005" },
    { id: 172, category: "設備", item_name: "換気扇交換（キッチン）", unit: "台", cost_price: 10000, selling_price: 18000, vendor_id: "V-005" },
    { id: 173, category: "設備", item_name: "24時間換気システム点検", unit: "式", cost_price: 5000, selling_price: 10000, vendor_id: "V-005" },

    // 防水・外装追加
    { id: 180, category: "外装", item_name: "外壁クラック補修", unit: "箇所", cost_price: 2000, selling_price: 4000, vendor_id: "V-002" },
    { id: 181, category: "外装", item_name: "鉄部塗装（手摺・階段）", unit: "m", cost_price: 1500, selling_price: 2800, vendor_id: "V-008" },
    { id: 182, category: "外装", item_name: "共用部塗装", unit: "m2", cost_price: 1800, selling_price: 3200, vendor_id: "V-008" },

    // クリーニング追加
    { id: 190, category: "クリーニング", item_name: "ハウスクリーニング（3LDK）", unit: "式", cost_price: 45000, selling_price: 70000, vendor_id: "V-004" },
    { id: 191, category: "クリーニング", item_name: "水回りクリーニング", unit: "式", cost_price: 15000, selling_price: 25000, vendor_id: "V-004" },
    { id: 192, category: "クリーニング", item_name: "ベランダ清掃", unit: "式", cost_price: 5000, selling_price: 10000, vendor_id: "V-004" },
  ];

  // サンプル案件 — 実際のビジネスに近い内容
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonth = (() => { const d = addMonths(now, -1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
  const twoMonthsAgo = (() => { const d = addMonths(now, -2); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();

  const projects: Project[] = [
    { project_id: "P-001", customer_id: "C-001", customer_name: "矢島不動産管理", project_name: "練馬区桜台 2F 原状回復", site_address: "東京都練馬区桜台3-XX-XX", owner_name: "吉野博", project_status: "入金済", created_at: `${twoMonthsAgo}-05` },
    { project_id: "P-002", customer_id: "C-001", customer_name: "矢島不動産管理", project_name: "中野区新井 1K 原状回復", site_address: "東京都中野区新井1-XX-XX", owner_name: "吉野博", project_status: "請求済", created_at: `${lastMonth}-10` },
    { project_id: "P-003", customer_id: "C-002", customer_name: "一建設", project_name: "江戸川区 戸建リノベ", site_address: "東京都江戸川区北葛西X-XX-XX", owner_name: "吉野博", project_status: "施工中", created_at: `${lastMonth}-15`, estimated_start: `${thisMonth}-01`, estimated_end: `${thisMonth}-28` },
    { project_id: "P-004", customer_id: "C-001", customer_name: "矢島不動産管理", project_name: "板橋区 3DK 原状回復", site_address: "東京都板橋区板橋X-XX-XX", owner_name: "吉野博", project_status: "受注", created_at: `${thisMonth}-01`, estimated_start: `${thisMonth}-15` },
    { project_id: "P-005", customer_id: "C-002", customer_name: "一建設", project_name: "足立区 2LDK リフォーム", site_address: "東京都足立区千住X-XX-XX", owner_name: "吉野博", project_status: "見積中", created_at: `${thisMonth}-10` },
    { project_id: "P-006", customer_id: "C-004", customer_name: "石澤クリーニング", project_name: "葛飾区 テナント改修", site_address: "東京都葛飾区亀有X-XX-XX", owner_name: "吉野博", project_status: "見積中", created_at: `${thisMonth}-14` },
    { project_id: "P-007", customer_id: "C-001", customer_name: "矢島不動産管理", project_name: "豊島区 1R 原状回復", site_address: "東京都豊島区南池袋X-XX-XX", owner_name: "吉野博", project_status: "施工中", created_at: `${lastMonth}-20`, estimated_start: `${thisMonth}-05`, estimated_end: `${thisMonth}-20` },
    { project_id: "P-008", customer_id: "C-002", customer_name: "一建設", project_name: "墨田区 戸建外壁塗装", site_address: "東京都墨田区東向島X-XX-XX", owner_name: "吉野博", project_status: "受注", created_at: `${thisMonth}-08`, estimated_start: `${thisMonth}-20` },
  ];

  // 見積明細
  const project_items: ProjectItem[] = [
    // P-001: 完了案件（1K原状回復）
    { id: 1, project_id: "P-001", category: "内装", item_name: "クロス貼替（量産）", unit: "m2", quantity: 45, cost_price: 850, selling_price: 1400 },
    { id: 2, project_id: "P-001", category: "内装", item_name: "CF貼替", unit: "m2", quantity: 12, cost_price: 2800, selling_price: 4500 },
    { id: 3, project_id: "P-001", category: "クリーニング", item_name: "ハウスクリーニング（1K）", unit: "式", quantity: 1, cost_price: 22000, selling_price: 35000 },
    { id: 4, project_id: "P-001", category: "諸経費", item_name: "廃棄物処理", unit: "式", quantity: 1, cost_price: 15000, selling_price: 25000 },

    // P-002: 請求済（1K原状回復）
    { id: 10, project_id: "P-002", category: "内装", item_name: "クロス貼替（量産）", unit: "m2", quantity: 38, cost_price: 850, selling_price: 1400 },
    { id: 11, project_id: "P-002", category: "畳・襖", item_name: "畳表替え", unit: "枚", quantity: 6, cost_price: 3900, selling_price: 6500 },
    { id: 12, project_id: "P-002", category: "畳・襖", item_name: "襖張替え（両面）", unit: "枚", quantity: 4, cost_price: 4000, selling_price: 7000 },
    { id: 13, project_id: "P-002", category: "クリーニング", item_name: "ハウスクリーニング（1K）", unit: "式", quantity: 1, cost_price: 22000, selling_price: 35000 },
    { id: 14, project_id: "P-002", category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 15000 },

    // P-003: 施工中（戸建リノベ — 大型案件）
    { id: 20, project_id: "P-003", category: "内装", item_name: "クロス貼替（1000番台）", unit: "m2", quantity: 120, cost_price: 1100, selling_price: 1800 },
    { id: 21, project_id: "P-003", category: "大工", item_name: "床張替え（フローリング）", unit: "m2", quantity: 65, cost_price: 6000, selling_price: 9500 },
    { id: 22, project_id: "P-003", category: "設備", item_name: "トイレ交換", unit: "台", quantity: 2, cost_price: 45000, selling_price: 85000 },
    { id: 23, project_id: "P-003", category: "設備", item_name: "洗面台交換", unit: "台", quantity: 1, cost_price: 35000, selling_price: 65000 },
    { id: 24, project_id: "P-003", category: "設備", item_name: "給湯器交換", unit: "台", quantity: 1, cost_price: 85000, selling_price: 150000 },
    { id: 25, project_id: "P-003", category: "塗装", item_name: "室内塗装（壁）", unit: "m2", quantity: 30, cost_price: 1200, selling_price: 2000 },
    { id: 26, project_id: "P-003", category: "電気", item_name: "照明器具交換", unit: "箇所", quantity: 8, cost_price: 5000, selling_price: 9000 },
    { id: 27, project_id: "P-003", category: "クリーニング", item_name: "ハウスクリーニング（2DK）", unit: "式", quantity: 1, cost_price: 35000, selling_price: 55000 },
    { id: 28, project_id: "P-003", category: "諸経費", item_name: "廃棄物処理", unit: "式", quantity: 1, cost_price: 15000, selling_price: 25000 },
    { id: 29, project_id: "P-003", category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 30000 },

    // P-004: 受注（3DK原状回復）
    { id: 30, project_id: "P-004", category: "内装", item_name: "クロス貼替（量産）", unit: "m2", quantity: 75, cost_price: 850, selling_price: 1400 },
    { id: 31, project_id: "P-004", category: "内装", item_name: "CF貼替", unit: "m2", quantity: 18, cost_price: 2800, selling_price: 4500 },
    { id: 32, project_id: "P-004", category: "畳・襖", item_name: "畳表替え", unit: "枚", quantity: 12, cost_price: 3900, selling_price: 6500 },
    { id: 33, project_id: "P-004", category: "畳・襖", item_name: "障子張替え", unit: "枚", quantity: 4, cost_price: 2500, selling_price: 4500 },
    { id: 34, project_id: "P-004", category: "クリーニング", item_name: "ハウスクリーニング（2DK）", unit: "式", quantity: 1, cost_price: 35000, selling_price: 55000 },
    { id: 35, project_id: "P-004", category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 20000 },

    // P-005: 見積中（2LDKリフォーム）
    { id: 40, project_id: "P-005", category: "内装", item_name: "クロス貼替（1000番台）", unit: "m2", quantity: 85, cost_price: 1100, selling_price: 1800 },
    { id: 41, project_id: "P-005", category: "大工", item_name: "床張替え（フローリング）", unit: "m2", quantity: 40, cost_price: 6000, selling_price: 9500 },
    { id: 42, project_id: "P-005", category: "設備", item_name: "混合水栓交換", unit: "箇所", quantity: 3, cost_price: 15000, selling_price: 28000 },
    { id: 43, project_id: "P-005", category: "電気", item_name: "コンセント増設", unit: "箇所", quantity: 2, cost_price: 8000, selling_price: 15000 },

    // P-006: 見積中（テナント改修）
    { id: 50, project_id: "P-006", category: "内装", item_name: "クロス貼替（1000番台）", unit: "m2", quantity: 150, cost_price: 1100, selling_price: 1800 },
    { id: 51, project_id: "P-006", category: "内装", item_name: "フロアタイル貼り", unit: "m2", quantity: 60, cost_price: 3500, selling_price: 5500 },
    { id: 52, project_id: "P-006", category: "塗装", item_name: "室内塗装（壁）", unit: "m2", quantity: 50, cost_price: 1200, selling_price: 2000 },
    { id: 53, project_id: "P-006", category: "電気", item_name: "分電盤交換", unit: "台", quantity: 1, cost_price: 35000, selling_price: 60000 },
    { id: 54, project_id: "P-006", category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 35000 },

    // P-007: 施工中（1R原状回復）
    { id: 60, project_id: "P-007", category: "内装", item_name: "クロス貼替（量産）", unit: "m2", quantity: 30, cost_price: 850, selling_price: 1400 },
    { id: 61, project_id: "P-007", category: "クリーニング", item_name: "ハウスクリーニング（1K）", unit: "式", quantity: 1, cost_price: 22000, selling_price: 35000 },
    { id: 62, project_id: "P-007", category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 10000 },

    // P-008: 受注（外壁塗装）
    { id: 70, project_id: "P-008", category: "塗装", item_name: "外壁塗装", unit: "m2", quantity: 120, cost_price: 2500, selling_price: 4200 },
    { id: 71, project_id: "P-008", category: "塗装", item_name: "木部塗装", unit: "m2", quantity: 25, cost_price: 1800, selling_price: 3000 },
    { id: 72, project_id: "P-008", category: "諸経費", item_name: "養生費", unit: "式", quantity: 1, cost_price: 5000, selling_price: 10000 },
    { id: 73, project_id: "P-008", category: "諸経費", item_name: "廃棄物処理", unit: "式", quantity: 1, cost_price: 15000, selling_price: 25000 },
  ];

  // 請求データ
  const invoices: Invoice[] = [
    // P-001: 入金済
    { invoice_id: "INV-001", project_id: "P-001", invoice_amount: 157000, billed_at: `${twoMonthsAgo}-20`, due_date: `${lastMonth}-20`, paid_amount: 157000, remaining_amount: 0, status: "入金済" },
    // P-002: 請求済（未入金）
    { invoice_id: "INV-002", project_id: "P-002", invoice_amount: 152200, billed_at: `${lastMonth}-25`, due_date: `${thisMonth}-25`, paid_amount: 0, remaining_amount: 152200, status: "未入金" },
    // P-007: 施工中だが一部請求
    { invoice_id: "INV-003", project_id: "P-007", invoice_amount: 87000, billed_at: `${thisMonth}-10`, due_date: `${thisMonth}-28`, paid_amount: 0, remaining_amount: 87000, status: "未入金" },
  ];

  // 支払データ
  const payments: Payment[] = [
    // P-001: 支払済
    { payment_id: "PAY-001", project_id: "P-001", vendor_id: "V-001", vendor_name: "M-Pros", work_description: "クロス・CF施工", ordered_amount: 71850, paid_amount: 71850, remaining_amount: 0, status: "支払済", paid_at: `${lastMonth}-15` },
    { payment_id: "PAY-002", project_id: "P-001", vendor_id: "V-004", vendor_name: "ハートフルホーム", work_description: "ハウスクリーニング", ordered_amount: 22000, paid_amount: 22000, remaining_amount: 0, status: "支払済", paid_at: `${lastMonth}-15` },
    // P-002
    { payment_id: "PAY-003", project_id: "P-002", vendor_id: "V-001", vendor_name: "M-Pros", work_description: "クロス施工", ordered_amount: 32300, paid_amount: 0, remaining_amount: 32300, status: "未支払" },
    { payment_id: "PAY-004", project_id: "P-002", vendor_id: "V-007", vendor_name: "キツタカ", work_description: "畳・襖", ordered_amount: 39400, paid_amount: 0, remaining_amount: 39400, status: "未支払" },
    // P-003: 施工中 — 大型
    { payment_id: "PAY-005", project_id: "P-003", vendor_id: "V-001", vendor_name: "M-Pros", work_description: "クロス施工", ordered_amount: 132000, paid_amount: 66000, remaining_amount: 66000, status: "一部支払", paid_at: `${thisMonth}-05` },
    { payment_id: "PAY-006", project_id: "P-003", vendor_id: "V-003", vendor_name: "秀英", work_description: "大工・フローリング", ordered_amount: 390000, paid_amount: 0, remaining_amount: 390000, status: "未支払" },
    { payment_id: "PAY-007", project_id: "P-003", vendor_id: "V-010", vendor_name: "サンヨーコーポレーション", work_description: "設備工事", ordered_amount: 165000, paid_amount: 0, remaining_amount: 165000, status: "未支払" },
    { payment_id: "PAY-008", project_id: "P-003", vendor_id: "V-005", vendor_name: "ELITZ", work_description: "照明工事", ordered_amount: 40000, paid_amount: 0, remaining_amount: 40000, status: "未支払" },
  ];

  return { customers, vendors, projects, work_items, project_items, invoices, payments };
}

// ============================================================
// LocalDB Read/Write — データ消失を絶対に起こさない
// ============================================================

function readLocalDb(): LocalDb {
  if (!isBrowser()) return seedLocalDb();
  const raw = window.localStorage.getItem(LOCAL_DB_KEY);
  if (!raw) {
    const seeded = seedLocalDb();
    window.localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    return JSON.parse(raw) as LocalDb;
  } catch {
    // パースに失敗した場合のみseedにフォールバック（これ以外でデータリセットしない）
    const seeded = seedLocalDb();
    window.localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function writeLocalDb(db: LocalDb) {
  if (!isBrowser()) return;
  window.localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
}

// ============================================================
// API Fallback Pattern
// ============================================================

function normalizeNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/DNS_HOSTNAME_RESOLVED_PRIVATE|ENOTFOUND|Failed to fetch|NetworkError|fetch failed/i.test(message)) {
    return "APIに接続できません。ローカルモードで動作中。";
  }
  return message;
}

function clearLocalMode() {
  if (!isBrowser()) return;
  if (!window.sessionStorage.getItem(LOCAL_MODE_KEY)) return;
  window.sessionStorage.removeItem(LOCAL_MODE_KEY);
  window.dispatchEvent(new Event(LOCAL_MODE_EVENT));
}

function markLocalMode(reason: unknown) {
  if (!isBrowser()) return;
  if (!window.sessionStorage.getItem(LOCAL_MODE_KEY)) {
    window.sessionStorage.setItem(LOCAL_MODE_KEY, "1");
    console.warn("[LinK] ローカルデータモード", reason);
    window.dispatchEvent(new Event(LOCAL_MODE_EVENT));
  }
}

function apiFetch(input: string, init?: RequestInit) {
  const headers = new Headers(init?.headers ?? undefined);
  if (API_KEY) headers.set("X-API-Key", API_KEY);
  return fetch(input, { ...init, headers });
}

async function withFallback<T>(
  remote: () => Promise<T>,
  fallback: () => T | Promise<T>,
) {
  if (isBrowser() && isLocalModeEnabled()) return await fallback();
  if (FORCE_LOCAL_DATA) { markLocalMode("FORCE_LOCAL_DATA"); return await fallback(); }
  try {
    const result = await remote();
    clearLocalMode();
    return result;
  } catch (error) {
    if (!isBrowser()) throw new Error(normalizeNetworkError(error));
    markLocalMode(error);
    return await fallback();
  }
}

export function isLocalModeEnabled() {
  if (!isBrowser()) return FORCE_LOCAL_DATA;
  return FORCE_LOCAL_DATA || window.sessionStorage.getItem(LOCAL_MODE_KEY) === "1";
}

export function onLocalModeChanged(callback: () => void) {
  if (!isBrowser()) return () => undefined;
  window.addEventListener(LOCAL_MODE_EVENT, callback);
  return () => window.removeEventListener(LOCAL_MODE_EVENT, callback);
}

// ============================================================
// Computed helpers（UIで使う計算関数）
// ============================================================

/** 明細1行の原価合計 */
export function itemCostTotal(item: ProjectItem) {
  return safeNum(item.cost_price) * safeNum(item.quantity);
}

/** 明細1行の売値合計 */
export function itemSellingTotal(item: ProjectItem) {
  return safeNum(item.selling_price) * safeNum(item.quantity);
}

/** 明細1行の粗利 */
export function itemMargin(item: ProjectItem) {
  return itemSellingTotal(item) - itemCostTotal(item);
}

/** 粗利率 (0-100) */
export function marginRate(selling: number, cost: number) {
  if (selling <= 0) return 0;
  return ((selling - cost) / selling) * 100;
}

// ============================================================
// Local CRUD Operations
// ============================================================

function localGetCustomers() { return readLocalDb().customers; }
function localGetVendors() { return readLocalDb().vendors; }
function localGetWorkItems() { return readLocalDb().work_items; }

function localGetProjects(params?: { customer_id?: string; status?: string }): ProjectListResponse {
  const db = readLocalDb();
  let items = [...db.projects];
  if (params?.customer_id) items = items.filter((x) => x.customer_id === params.customer_id);
  if (params?.status) items = items.filter((x) => x.project_status === params.status);
  return { items, total: items.length };
}

function localGetProject(projectId: string): Project {
  const row = readLocalDb().projects.find((x) => x.project_id === projectId);
  if (!row) throw new Error("案件が存在しません");
  return row;
}

function localCreateProject(payload: {
  customer_id: string;
  project_name: string;
  site_address?: string;
  owner_name?: string;
}) {
  const db = readLocalDb();
  const customer = db.customers.find((x) => x.customer_id === payload.customer_id);
  if (!customer) throw new Error("顧客が存在しません");
  const projectId = nextId(db.projects.map((x) => x.project_id), "P");
  const project: Project = {
    project_id: projectId,
    customer_id: customer.customer_id,
    customer_name: customer.customer_name,
    project_name: (payload.project_name || "案件").trim(),
    site_address: payload.site_address?.trim() || null,
    owner_name: payload.owner_name?.trim() || "吉野博",
    project_status: "見積中",
    created_at: ymd(),
  };
  db.projects.push(project);
  writeLocalDb(db);
  return project;
}

function localUpdateProjectStatus(projectId: string, status: string) {
  const db = readLocalDb();
  const project = db.projects.find((x) => x.project_id === projectId);
  if (!project) throw new Error("案件が存在しません");
  project.project_status = status;
  writeLocalDb(db);
  return project;
}

function localGetProjectItems(projectId: string) {
  return readLocalDb().project_items.filter((x) => x.project_id === projectId);
}

function localCreateProjectItem(
  projectId: string,
  payload: {
    master_item_id?: number;
    category?: string;
    item_name?: string;
    specification?: string;
    unit?: string;
    quantity: number;
    cost_price?: number;
    selling_price?: number;
    vendor_id?: string;
  },
): ProjectItem {
  const db = readLocalDb();
  if (!db.projects.find((x) => x.project_id === projectId)) throw new Error("案件が存在しません");
  const master = payload.master_item_id ? db.work_items.find((x) => x.id === payload.master_item_id) : undefined;
  const row: ProjectItem = {
    id: (db.project_items.reduce((m, x) => Math.max(m, x.id), 0) || 0) + 1,
    project_id: projectId,
    category: payload.category ?? master?.category ?? "その他",
    item_name: payload.item_name ?? master?.item_name ?? "項目",
    specification: payload.specification ?? master?.specification ?? null,
    unit: payload.unit ?? master?.unit ?? "式",
    quantity: safeNum(payload.quantity || 1),
    cost_price: safeNum(payload.cost_price ?? master?.cost_price ?? 0),
    selling_price: safeNum(payload.selling_price ?? master?.selling_price ?? 0),
    vendor_id: payload.vendor_id ?? master?.vendor_id ?? null,
  };
  db.project_items.push(row);
  writeLocalDb(db);
  return row;
}

function localUpdateProjectItem(
  itemId: number,
  payload: Partial<Pick<ProjectItem, "quantity" | "cost_price" | "selling_price" | "item_name" | "specification" | "unit">>,
): ProjectItem {
  const db = readLocalDb();
  const row = db.project_items.find((x) => x.id === itemId);
  if (!row) throw new Error("明細が存在しません");
  if (payload.quantity !== undefined) row.quantity = safeNum(payload.quantity);
  if (payload.cost_price !== undefined) row.cost_price = safeNum(payload.cost_price);
  if (payload.selling_price !== undefined) row.selling_price = safeNum(payload.selling_price);
  if (payload.item_name !== undefined) row.item_name = payload.item_name;
  if (payload.specification !== undefined) row.specification = payload.specification;
  if (payload.unit !== undefined) row.unit = payload.unit;
  writeLocalDb(db);
  return row;
}

function localDeleteProjectItem(itemId: number) {
  const db = readLocalDb();
  const idx = db.project_items.findIndex((x) => x.id === itemId);
  if (idx === -1) throw new Error("明細が存在しません");
  db.project_items.splice(idx, 1);
  writeLocalDb(db);
}

function localGetInvoices(projectId?: string) {
  const rows = readLocalDb().invoices;
  return projectId ? rows.filter((x) => x.project_id === projectId) : rows;
}

function localCreateInvoice(payload: {
  project_id: string;
  invoice_amount: number;
  billed_at?: string;
  due_date?: string;
  paid_amount?: number;
  note?: string;
}): Invoice {
  const db = readLocalDb();
  if (!db.projects.find((x) => x.project_id === payload.project_id)) throw new Error("案件が存在しません");
  const invoiceId = nextId(db.invoices.map((x) => x.invoice_id), "INV");
  const amount = safeNum(payload.invoice_amount);
  const paid = safeNum(payload.paid_amount ?? 0);
  const billedAt = payload.billed_at ?? ymd();
  const dueDate = payload.due_date ?? (() => { const d = new Date(billedAt); d.setDate(d.getDate() + 30); return ymd(d); })();
  const row: Invoice = {
    invoice_id: invoiceId,
    project_id: payload.project_id,
    invoice_amount: amount,
    billed_at: billedAt,
    due_date: dueDate,
    paid_amount: paid,
    remaining_amount: Math.max(amount - paid, 0),
    status: invoiceStatus(amount, paid),
    note: payload.note ?? null,
  };
  db.invoices.push(row);
  writeLocalDb(db);
  return row;
}

function localUpdateInvoice(invoiceId: string, payload: { paid_amount?: number; invoice_amount?: number; note?: string }): Invoice {
  const db = readLocalDb();
  const row = db.invoices.find((x) => x.invoice_id === invoiceId);
  if (!row) throw new Error("請求が存在しません");
  if (payload.invoice_amount !== undefined) row.invoice_amount = safeNum(payload.invoice_amount);
  if (payload.paid_amount !== undefined) row.paid_amount = safeNum(payload.paid_amount);
  if (payload.note !== undefined) row.note = payload.note;
  row.remaining_amount = Math.max(row.invoice_amount - row.paid_amount, 0);
  row.status = invoiceStatus(row.invoice_amount, row.paid_amount);
  writeLocalDb(db);
  return row;
}

function localGetPayments(projectId?: string) {
  const rows = readLocalDb().payments;
  return projectId ? rows.filter((x) => x.project_id === projectId) : rows;
}

function localCreatePayment(payload: {
  project_id: string;
  vendor_id?: string;
  vendor_name?: string;
  work_description?: string;
  ordered_amount: number;
  paid_amount?: number;
  note?: string;
}): Payment {
  const db = readLocalDb();
  if (!db.projects.find((x) => x.project_id === payload.project_id)) throw new Error("案件が存在しません");
  const paymentId = nextId(db.payments.map((x) => x.payment_id), "PAY");
  const ordered = safeNum(payload.ordered_amount);
  const paid = safeNum(payload.paid_amount ?? 0);
  const row: Payment = {
    payment_id: paymentId,
    project_id: payload.project_id,
    vendor_id: payload.vendor_id ?? null,
    vendor_name: payload.vendor_name ?? "未設定",
    work_description: payload.work_description ?? null,
    ordered_amount: ordered,
    paid_amount: paid,
    remaining_amount: Math.max(ordered - paid, 0),
    status: paymentStatus(ordered, paid),
    paid_at: null,
    note: payload.note ?? null,
  };
  db.payments.push(row);
  writeLocalDb(db);
  return row;
}

function localUpdatePayment(paymentId: string, payload: { paid_amount?: number; ordered_amount?: number; note?: string }): Payment {
  const db = readLocalDb();
  const row = db.payments.find((x) => x.payment_id === paymentId);
  if (!row) throw new Error("支払が存在しません");
  if (payload.ordered_amount !== undefined) row.ordered_amount = safeNum(payload.ordered_amount);
  if (payload.paid_amount !== undefined) row.paid_amount = safeNum(payload.paid_amount);
  if (payload.note !== undefined) row.note = payload.note;
  row.remaining_amount = Math.max(row.ordered_amount - row.paid_amount, 0);
  row.status = paymentStatus(row.ordered_amount, row.paid_amount);
  writeLocalDb(db);
  return row;
}

// ============================================================
// Dashboard — 銀行が融資判断できるレベルの経営概要
// ============================================================

function localDashboardOverview(): DashboardOverview {
  const db = readLocalDb();
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // 月次売上集計
  const monthly: DashboardMonthlySalesPoint[] = Array.from({ length: 12 }, (_, i) => ({
    month: `${i + 1}月`, amount: 0, cost: 0, margin: 0,
  }));
  let current_month_sales = 0;
  let ytd_sales = 0;
  let last_year_ytd_sales = 0;
  let all_time_sales = 0;

  for (const inv of db.invoices) {
    const billed = parseDate(inv.billed_at);
    if (!billed) continue;
    const amount = safeNum(inv.invoice_amount);
    all_time_sales += amount;
    if (billed.getFullYear() === currentYear) {
      monthly[billed.getMonth()].amount += amount;
      if (billed.getMonth() === currentMonth) current_month_sales += amount;
      if (billed <= today) ytd_sales += amount;
    } else if (billed.getFullYear() === currentYear - 1) {
      const lastYearSameDay = new Date(today);
      lastYearSameDay.setFullYear(currentYear - 1);
      if (billed <= lastYearSameDay) last_year_ytd_sales += amount;
    }
  }

  // 全案件の原価・売値集計
  const projectSelling = new Map<string, number>();
  const projectCost = new Map<string, number>();
  for (const item of db.project_items) {
    const s = safeNum(item.selling_price) * safeNum(item.quantity);
    const c = safeNum(item.cost_price) * safeNum(item.quantity);
    projectSelling.set(item.project_id, (projectSelling.get(item.project_id) ?? 0) + s);
    projectCost.set(item.project_id, (projectCost.get(item.project_id) ?? 0) + c);
  }

  let all_time_cost = 0;
  for (const c of projectCost.values()) all_time_cost += c;
  let all_time_selling = 0;
  for (const s of projectSelling.values()) all_time_selling += s;

  // 来月見込み: 受注+施工中で来月完了予定or進行中の案件の売値合計
  let next_month_projection = 0;
  let pipeline_total = 0;
  let pipeline_count = 0;

  const statusCounts: Record<string, number> = {};
  for (const p of db.projects) {
    statusCounts[p.project_status] = (statusCounts[p.project_status] ?? 0) + 1;
    const selling = projectSelling.get(p.project_id) ?? 0;
    if (p.project_status === "見積中" || p.project_status === "受注") {
      pipeline_total += selling;
      pipeline_count++;
    }
    if (p.project_status === "受注" || p.project_status === "施工中") {
      next_month_projection += selling;
    }
  }

  // 売掛・買掛
  const receivable_balance = db.invoices.reduce((s, x) => s + safeNum(x.remaining_amount), 0);
  const payable_balance = db.payments.reduce((s, x) => s + safeNum(x.remaining_amount), 0);

  // YoY
  const yoy_growth_rate = last_year_ytd_sales > 0
    ? ((ytd_sales - last_year_ytd_sales) / last_year_ytd_sales) * 100
    : 0;

  // 平均粗利率
  const avg_margin_rate = all_time_selling > 0
    ? ((all_time_selling - all_time_cost) / all_time_selling) * 100
    : 0;

  // 稼働案件
  const activeStatuses = new Set(["見積中", "受注", "施工中", "請求済"]);
  const active_projects: DashboardActiveProject[] = db.projects
    .filter((p) => activeStatuses.has(p.project_status))
    .map((p) => {
      const selling = projectSelling.get(p.project_id) ?? 0;
      const cost = projectCost.get(p.project_id) ?? 0;
      return {
        project_id: p.project_id,
        project_name: p.project_name,
        customer_name: p.customer_name,
        project_status: p.project_status,
        selling_total: selling,
        cost_total: cost,
        margin: selling - cost,
        margin_rate: selling > 0 ? ((selling - cost) / selling) * 100 : 0,
        created_at: p.created_at,
      };
    });

  // 仕入先ランキング
  const vendorTotals = new Map<string, { amount: number; count: number }>();
  for (const pay of db.payments) {
    const name = pay.vendor_name;
    const existing = vendorTotals.get(name) ?? { amount: 0, count: 0 };
    existing.amount += safeNum(pay.ordered_amount);
    existing.count += 1;
    vendorTotals.set(name, existing);
  }
  const top_vendors = Array.from(vendorTotals.entries())
    .map(([vendor_name, v]) => ({ vendor_name, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    current_month_sales,
    next_month_projection,
    pipeline_total,
    pipeline_count,
    ytd_sales,
    last_year_ytd_sales,
    yoy_growth_rate,
    receivable_balance,
    payable_balance,
    cash_position: receivable_balance - payable_balance,
    avg_margin_rate,
    all_time_sales,
    all_time_cost,
    all_time_margin: all_time_selling - all_time_cost,
    active_project_count: active_projects.length,
    status_counts: statusCounts,
    monthly_sales: monthly,
    active_projects,
    top_vendors,
  };
}

// ============================================================
// Public API — Export functions
// ============================================================

export async function getCustomers() {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/customers`, { cache: "no-store" });
      if (!res.ok) throw new Error("顧客一覧取得失敗");
      return await res.json();
    },
    () => localGetCustomers(),
  );
}

export async function getVendors() {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/vendors`, { cache: "no-store" });
      if (!res.ok) throw new Error("仕入先一覧取得失敗");
      return (await res.json()) as Vendor[];
    },
    () => localGetVendors(),
  );
}

export async function getWorkItems() {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/work-items`, { cache: "no-store" });
      if (!res.ok) throw new Error("工事項目取得失敗");
      return (await res.json()) as WorkItemMaster[];
    },
    () => localGetWorkItems(),
  );
}

export async function getProjects(params?: { customer_id?: string; status?: string }) {
  return withFallback(
    async () => {
      const search = new URLSearchParams();
      if (params?.customer_id) search.set("customer_id", params.customer_id);
      if (params?.status) search.set("status", params.status);
      const qs = search.toString();
      const res = await apiFetch(`${API_BASE}/api/v1/projects${qs ? `?${qs}` : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error("案件一覧取得失敗");
      return (await res.json()) as ProjectListResponse;
    },
    () => localGetProjects(params),
  );
}

export async function getProject(projectId: string) {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/projects/${encodeURIComponent(projectId)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("案件詳細取得失敗");
      return (await res.json()) as Project;
    },
    () => localGetProject(projectId),
  );
}

export async function createProject(payload: {
  customer_id: string;
  project_name: string;
  site_address?: string;
  owner_name?: string;
}) {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`案件作成失敗: ${await res.text()}`);
      return await res.json();
    },
    () => localCreateProject(payload),
  );
}

export async function updateProjectStatus(projectId: string, status: string) {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/projects/${encodeURIComponent(projectId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("ステータス更新失敗");
      return (await res.json()) as Project;
    },
    () => localUpdateProjectStatus(projectId, status),
  );
}

export async function getProjectItems(projectId: string) {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/projects/${projectId}/items`, { cache: "no-store" });
      if (!res.ok) throw new Error("明細取得失敗");
      return (await res.json()) as ProjectItem[];
    },
    () => localGetProjectItems(projectId),
  );
}

export async function createProjectItem(
  projectId: string,
  payload: {
    master_item_id?: number;
    category?: string;
    item_name?: string;
    specification?: string;
    unit?: string;
    quantity: number;
    cost_price?: number;
    selling_price?: number;
    vendor_id?: string;
  },
) {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/projects/${projectId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`明細追加失敗: ${await res.text()}`);
      return (await res.json()) as ProjectItem;
    },
    () => localCreateProjectItem(projectId, payload),
  );
}

export async function updateProjectItem(
  projectId: string,
  itemId: number,
  payload: Partial<Pick<ProjectItem, "quantity" | "cost_price" | "selling_price" | "item_name" | "specification" | "unit">>,
) {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/projects/${encodeURIComponent(projectId)}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("明細更新失敗");
      return (await res.json()) as ProjectItem;
    },
    () => localUpdateProjectItem(itemId, payload),
  );
}

export async function deleteProjectItem(projectId: string, itemId: number) {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/projects/${encodeURIComponent(projectId)}/items/${itemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("明細削除失敗");
    },
    () => localDeleteProjectItem(itemId),
  );
}

export async function getInvoices(projectId?: string) {
  return withFallback(
    async () => {
      const search = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
      const res = await apiFetch(`${API_BASE}/api/v1/invoices${search}`, { cache: "no-store" });
      if (!res.ok) throw new Error("請求一覧取得失敗");
      return (await res.json()) as Invoice[];
    },
    () => localGetInvoices(projectId),
  );
}

export async function createInvoice(payload: {
  project_id: string;
  invoice_amount: number;
  billed_at?: string;
  due_date?: string;
  paid_amount?: number;
  note?: string;
}) {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`請求登録失敗: ${await res.text()}`);
      return (await res.json()) as Invoice;
    },
    () => localCreateInvoice(payload),
  );
}

export async function updateInvoice(invoiceId: string, payload: { paid_amount?: number; invoice_amount?: number; note?: string }) {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/invoices/${encodeURIComponent(invoiceId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("請求更新失敗");
      return (await res.json()) as Invoice;
    },
    () => localUpdateInvoice(invoiceId, payload),
  );
}

export async function getPayments(projectId?: string) {
  return withFallback(
    async () => {
      const search = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
      const res = await apiFetch(`${API_BASE}/api/v1/payments${search}`, { cache: "no-store" });
      if (!res.ok) throw new Error("支払一覧取得失敗");
      return (await res.json()) as Payment[];
    },
    () => localGetPayments(projectId),
  );
}

export async function createPayment(payload: {
  project_id: string;
  vendor_id?: string;
  vendor_name?: string;
  work_description?: string;
  ordered_amount: number;
  paid_amount?: number;
  note?: string;
}) {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`支払登録失敗: ${await res.text()}`);
      return (await res.json()) as Payment;
    },
    () => localCreatePayment(payload),
  );
}

export async function updatePayment(paymentId: string, payload: { paid_amount?: number; ordered_amount?: number; note?: string }) {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/payments/${encodeURIComponent(paymentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("支払更新失敗");
      return (await res.json()) as Payment;
    },
    () => localUpdatePayment(paymentId, payload),
  );
}

export async function getDashboardOverview() {
  return withFallback(
    async () => {
      const res = await apiFetch(`${API_BASE}/api/v1/dashboard/overview`, { cache: "no-store" });
      if (!res.ok) throw new Error("ダッシュボード取得失敗");
      return (await res.json()) as DashboardOverview;
    },
    () => localDashboardOverview(),
  );
}

// ============================================================
// Blob helpers (PDF placeholder)
// ============================================================

function asciiToBytes(value: string) {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) bytes[i] = value.charCodeAt(i) & 0xff;
  return bytes;
}

function pdfEscape(value: string) {
  return value.replace(/[^\x20-\x7e]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdf(lines: string[]) {
  const safeLines = lines.map(pdfEscape);
  let stream = "BT\n/F1 14 Tf\n50 545 Td\n20 TL\n";
  for (const line of safeLines) stream += `(${line}) Tj\nT*\n`;
  stream += "ET\n";
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`,
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) { offsets.push(pdf.length); pdf += obj; }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return new Blob([asciiToBytes(pdf)], { type: "application/pdf" });
}

export async function exportEstimate(projectId: string) {
  const db = readLocalDb();
  const project = db.projects.find((p) => p.project_id === projectId);
  const items = db.project_items.filter((x) => x.project_id === projectId);
  const total = items.reduce((s, x) => s + safeNum(x.selling_price) * safeNum(x.quantity), 0);
  const blob = buildPdf([
    `Estimate: ${projectId}`,
    `Project: ${project?.project_name ?? "-"}`,
    `Customer: ${project?.customer_name ?? "-"}`,
    `Total: JPY ${Math.round(total).toLocaleString()}`,
    "", "Generated from LinK Estimate OS",
  ]);
  return { blob, disposition: null };
}

export function downloadBlob(blob: Blob, fallbackName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ============================================================
// Estimate Templates — パッケージ見積テンプレート
// ============================================================

export type EstimateTemplateItem = {
  category: string;
  item_name: string;
  unit: string;
  quantity: number;
  cost_price: number;
  selling_price: number;
};

export type EstimateTemplate = {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  items: EstimateTemplateItem[];
};

const ESTIMATE_TEMPLATES: EstimateTemplate[] = [
  {
    id: "tpl-1k-genjo",
    name: "1K 原状回復",
    description: "ワンルーム・1Kの基本原状回復パック（5項目）",
    keywords: ["1K", "1R", "ワンルーム", "原状回復", "原状"],
    items: [
      { category: "内装", item_name: "クロス貼替（量産）", unit: "m2", quantity: 40, cost_price: 850, selling_price: 1400 },
      { category: "内装", item_name: "CF貼替", unit: "m2", quantity: 10, cost_price: 2800, selling_price: 4500 },
      { category: "クリーニング", item_name: "ハウスクリーニング（1K）", unit: "式", quantity: 1, cost_price: 22000, selling_price: 35000 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 15000 },
      { category: "諸経費", item_name: "廃棄物処理", unit: "式", quantity: 1, cost_price: 15000, selling_price: 25000 },
    ],
  },
  {
    id: "tpl-2dk-genjo",
    name: "2DK 原状回復",
    description: "2DKの標準原状回復パック・畳襖含む（7項目）",
    keywords: ["2DK", "2K", "原状回復", "原状"],
    items: [
      { category: "内装", item_name: "クロス貼替（量産）", unit: "m2", quantity: 70, cost_price: 850, selling_price: 1400 },
      { category: "内装", item_name: "CF貼替", unit: "m2", quantity: 15, cost_price: 2800, selling_price: 4500 },
      { category: "畳・襖", item_name: "畳表替え", unit: "枚", quantity: 6, cost_price: 3900, selling_price: 6500 },
      { category: "畳・襖", item_name: "襖張替え（両面）", unit: "枚", quantity: 4, cost_price: 4000, selling_price: 7000 },
      { category: "クリーニング", item_name: "ハウスクリーニング（2DK）", unit: "式", quantity: 1, cost_price: 35000, selling_price: 55000 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 20000 },
      { category: "諸経費", item_name: "廃棄物処理", unit: "式", quantity: 1, cost_price: 15000, selling_price: 25000 },
    ],
  },
  {
    id: "tpl-3dk-genjo",
    name: "3DK 原状回復",
    description: "3DKの標準原状回復パック・和室あり（8項目）",
    keywords: ["3DK", "3K", "原状回復", "原状"],
    items: [
      { category: "内装", item_name: "クロス貼替（量産）", unit: "m2", quantity: 90, cost_price: 850, selling_price: 1400 },
      { category: "内装", item_name: "CF貼替", unit: "m2", quantity: 20, cost_price: 2800, selling_price: 4500 },
      { category: "畳・襖", item_name: "畳表替え", unit: "枚", quantity: 12, cost_price: 3900, selling_price: 6500 },
      { category: "畳・襖", item_name: "襖張替え（両面）", unit: "枚", quantity: 6, cost_price: 4000, selling_price: 7000 },
      { category: "畳・襖", item_name: "障子張替え", unit: "枚", quantity: 4, cost_price: 2500, selling_price: 4500 },
      { category: "クリーニング", item_name: "ハウスクリーニング（2DK）", unit: "式", quantity: 1, cost_price: 35000, selling_price: 55000 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 25000 },
      { category: "諸経費", item_name: "廃棄物処理", unit: "式", quantity: 1, cost_price: 15000, selling_price: 25000 },
    ],
  },
  {
    id: "tpl-unit-bath",
    name: "ユニットバス工事",
    description: "UB周り設備交換一式（5項目）",
    keywords: ["ユニットバス", "UB", "浴室", "風呂", "バス", "水回り"],
    items: [
      { category: "設備", item_name: "トイレ交換", unit: "台", quantity: 1, cost_price: 45000, selling_price: 85000 },
      { category: "設備", item_name: "洗面台交換", unit: "台", quantity: 1, cost_price: 35000, selling_price: 65000 },
      { category: "設備", item_name: "混合水栓交換", unit: "箇所", quantity: 2, cost_price: 15000, selling_price: 28000 },
      { category: "設備", item_name: "給湯器交換", unit: "台", quantity: 1, cost_price: 85000, selling_price: 150000 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 20000 },
    ],
  },
  {
    id: "tpl-gaiheki",
    name: "外壁塗装パック",
    description: "戸建外壁塗装の基本セット（4項目）",
    keywords: ["外壁", "塗装", "ペンキ", "外装"],
    items: [
      { category: "塗装", item_name: "外壁塗装", unit: "m2", quantity: 120, cost_price: 2500, selling_price: 4200 },
      { category: "塗装", item_name: "木部塗装", unit: "m2", quantity: 25, cost_price: 1800, selling_price: 3000 },
      { category: "諸経費", item_name: "養生費", unit: "式", quantity: 1, cost_price: 5000, selling_price: 10000 },
      { category: "諸経費", item_name: "廃棄物処理", unit: "式", quantity: 1, cost_price: 15000, selling_price: 25000 },
    ],
  },
  {
    id: "tpl-3ldk-full",
    name: "3LDK戸建フルリノベーション",
    description: "3LDK戸建の全面リノベ概算（13項目）",
    keywords: ["3LDK", "フルリノベ", "リノベーション", "全面改修", "戸建", "フル"],
    items: [
      { category: "内装", item_name: "クロス貼替（1000番台）", unit: "m2", quantity: 150, cost_price: 1100, selling_price: 1800 },
      { category: "大工", item_name: "床張替え（フローリング）", unit: "m2", quantity: 80, cost_price: 6000, selling_price: 9500 },
      { category: "設備", item_name: "トイレ交換", unit: "台", quantity: 1, cost_price: 45000, selling_price: 85000 },
      { category: "設備", item_name: "洗面台交換", unit: "台", quantity: 1, cost_price: 35000, selling_price: 65000 },
      { category: "設備", item_name: "混合水栓交換", unit: "箇所", quantity: 3, cost_price: 15000, selling_price: 28000 },
      { category: "設備", item_name: "給湯器交換", unit: "台", quantity: 1, cost_price: 85000, selling_price: 150000 },
      { category: "電気", item_name: "照明器具交換", unit: "箇所", quantity: 10, cost_price: 5000, selling_price: 9000 },
      { category: "電気", item_name: "コンセント増設", unit: "箇所", quantity: 4, cost_price: 8000, selling_price: 15000 },
      { category: "塗装", item_name: "外壁塗装", unit: "m2", quantity: 100, cost_price: 2500, selling_price: 4200 },
      { category: "クリーニング", item_name: "ハウスクリーニング（2DK）", unit: "式", quantity: 1, cost_price: 35000, selling_price: 55000 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 35000 },
      { category: "諸経費", item_name: "廃棄物処理", unit: "式", quantity: 1, cost_price: 15000, selling_price: 25000 },
      { category: "諸経費", item_name: "養生費", unit: "式", quantity: 1, cost_price: 5000, selling_price: 10000 },
    ],
  },
  // --- 追加テンプレート ---
  {
    id: "tpl-1r-genjo",
    name: "1R 原状回復",
    description: "ワンルームの最小原状回復パック（3項目）",
    keywords: ["1R", "ワンルーム", "原状"],
    items: [
      { category: "内装", item_name: "クロス貼替（量産）", unit: "m2", quantity: 30, cost_price: 850, selling_price: 1400 },
      { category: "クリーニング", item_name: "ハウスクリーニング（1K）", unit: "式", quantity: 1, cost_price: 22000, selling_price: 35000 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 10000 },
    ],
  },
  {
    id: "tpl-1ldk-genjo",
    name: "1LDK 原状回復",
    description: "1LDKの標準原状回復パック（6項目）",
    keywords: ["1LDK", "原状"],
    items: [
      { category: "内装", item_name: "クロス貼替（量産）", unit: "m2", quantity: 55, cost_price: 850, selling_price: 1400 },
      { category: "内装", item_name: "CF貼替", unit: "m2", quantity: 12, cost_price: 2800, selling_price: 4500 },
      { category: "クリーニング", item_name: "ハウスクリーニング（1K）", unit: "式", quantity: 1, cost_price: 22000, selling_price: 35000 },
      { category: "設備", item_name: "混合水栓交換", unit: "箇所", quantity: 1, cost_price: 15000, selling_price: 28000 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 15000 },
      { category: "諸経費", item_name: "廃棄物処理", unit: "式", quantity: 1, cost_price: 15000, selling_price: 25000 },
    ],
  },
  {
    id: "tpl-2ldk-genjo",
    name: "2LDK 原状回復",
    description: "2LDKの標準原状回復パック（7項目）",
    keywords: ["2LDK", "原状"],
    items: [
      { category: "内装", item_name: "クロス貼替（量産）", unit: "m2", quantity: 80, cost_price: 850, selling_price: 1400 },
      { category: "内装", item_name: "CF貼替", unit: "m2", quantity: 18, cost_price: 2800, selling_price: 4500 },
      { category: "内装", item_name: "巾木交換", unit: "m", quantity: 30, cost_price: 600, selling_price: 1000 },
      { category: "クリーニング", item_name: "ハウスクリーニング（2DK）", unit: "式", quantity: 1, cost_price: 35000, selling_price: 55000 },
      { category: "設備", item_name: "混合水栓交換", unit: "箇所", quantity: 2, cost_price: 15000, selling_price: 28000 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 20000 },
      { category: "諸経費", item_name: "廃棄物処理", unit: "式", quantity: 1, cost_price: 15000, selling_price: 25000 },
    ],
  },
  {
    id: "tpl-kitchen-pack",
    name: "キッチン交換パック",
    description: "ミニキッチン交換と周辺工事一式（4項目）",
    keywords: ["キッチン", "台所"],
    items: [
      { category: "設備", item_name: "キッチン交換（ミニ）", unit: "台", quantity: 1, cost_price: 80000, selling_price: 140000 },
      { category: "内装", item_name: "クロス貼替（量産）", unit: "m2", quantity: 10, cost_price: 850, selling_price: 1400 },
      { category: "内装", item_name: "CF貼替", unit: "m2", quantity: 6, cost_price: 2800, selling_price: 4500 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 15000 },
    ],
  },
  {
    id: "tpl-mizumawari-4ten",
    name: "水回り4点セット",
    description: "キッチン・トイレ・洗面・浴室水栓まるごとパック（6項目）",
    keywords: ["水回り", "4点", "まるごと"],
    items: [
      { category: "設備", item_name: "キッチン交換（ミニ）", unit: "台", quantity: 1, cost_price: 80000, selling_price: 140000 },
      { category: "設備", item_name: "トイレ交換", unit: "台", quantity: 1, cost_price: 45000, selling_price: 85000 },
      { category: "設備", item_name: "洗面台交換", unit: "台", quantity: 1, cost_price: 35000, selling_price: 65000 },
      { category: "設備", item_name: "混合水栓交換", unit: "箇所", quantity: 3, cost_price: 15000, selling_price: 28000 },
      { category: "設備", item_name: "排水管洗浄", unit: "式", quantity: 1, cost_price: 8000, selling_price: 15000 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 25000 },
    ],
  },
  {
    id: "tpl-taikyo-cleaning",
    name: "退去時クリーニング基本パック",
    description: "退去後の基本クリーニングセット（3項目）",
    keywords: ["退去", "クリーニング", "引渡"],
    items: [
      { category: "クリーニング", item_name: "ハウスクリーニング（1K）", unit: "式", quantity: 1, cost_price: 22000, selling_price: 35000 },
      { category: "クリーニング", item_name: "エアコンクリーニング", unit: "台", quantity: 1, cost_price: 8000, selling_price: 15000 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 10000 },
    ],
  },
];

export function getEstimateTemplates(): EstimateTemplate[] {
  return ESTIMATE_TEMPLATES;
}

export async function addTemplateToProject(projectId: string, templateId: string): Promise<ProjectItem[]> {
  const template = ESTIMATE_TEMPLATES.find((t) => t.id === templateId);
  if (!template) throw new Error("テンプレートが見つかりません");
  const added: ProjectItem[] = [];
  for (const item of template.items) {
    const created = await createProjectItem(projectId, {
      category: item.category,
      item_name: item.item_name,
      unit: item.unit,
      quantity: item.quantity,
      cost_price: item.cost_price,
      selling_price: item.selling_price,
    });
    added.push(created);
  }
  return added;
}

// HTML見積書（ブラウザ印刷→PDF変換用）3ページ構成: 表紙 / 大項目サマリー / 明細
export function exportEstimateHtml(projectId: string, options?: { staffName?: string }): string {
  const db = readLocalDb();
  const project = db.projects.find((p) => p.project_id === projectId);
  const items = db.project_items.filter((x) => x.project_id === projectId);

  const groups = new Map<string, ProjectItem[]>();
  for (const item of items) {
    const cat = item.category || "その他";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(item);
  }

  const total = items.reduce((s, x) => s + safeNum(x.selling_price) * safeNum(x.quantity), 0);
  const yenFmt = (v: number) => `&yen;${Math.round(v).toLocaleString()}`;

  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const staffName = options?.staffName || "";

  // --- ページ2: 大項目サマリー行 ---
  let summaryRows = "";
  let summaryNo = 1;
  for (const [cat, catItems] of groups.entries()) {
    const catTotal = catItems.reduce((s, x) => s + safeNum(x.selling_price) * safeNum(x.quantity), 0);
    summaryRows += `<tr>
      <td style="text-align:center;padding:10px 6px">${summaryNo++}</td>
      <td style="padding:10px 6px;font-weight:500">${cat}</td>
      <td style="text-align:right;padding:10px 6px;font-weight:600">${yenFmt(catTotal)}</td>
    </tr>`;
  }

  // --- ページ3: 明細行 ---
  let detailRows = "";
  let rowNum = 1;
  for (const [cat, catItems] of groups.entries()) {
    const catTotal = catItems.reduce((s, x) => s + safeNum(x.selling_price) * safeNum(x.quantity), 0);
    detailRows += `<tr class="cat-header">
      <td colspan="7" style="background:#e8edf5;font-weight:700;color:#1e40af;padding:6px 8px;font-size:12px;border-bottom:2px solid #1e40af">${cat}</td>
    </tr>`;
    for (const item of catItems) {
      const lineTotal = safeNum(item.selling_price) * safeNum(item.quantity);
      detailRows += `<tr>
        <td style="text-align:center">${rowNum++}</td>
        <td>${item.item_name}</td>
        <td style="font-size:10px;color:#666">${item.specification || ""}</td>
        <td style="text-align:right">${item.quantity}</td>
        <td style="text-align:center">${item.unit}</td>
        <td style="text-align:right">${yenFmt(item.selling_price)}</td>
        <td style="text-align:right;font-weight:600">${yenFmt(lineTotal)}</td>
      </tr>`;
    }
    detailRows += `<tr class="cat-subtotal">
      <td colspan="6" style="text-align:right;padding-right:12px;font-weight:600;background:#f8fafc;border-top:1px solid #cbd5e1">${cat} 小計</td>
      <td style="text-align:right;font-weight:700;background:#f8fafc;border-top:1px solid #cbd5e1">${yenFmt(catTotal)}</td>
    </tr>`;
  }

  return `<!DOCTYPE html><html lang="ja">
<head><meta charset="utf-8">
<title>御見積書 - ${project?.project_name ?? projectId}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:"Hiragino Kaku Gothic Pro","Yu Gothic","Meiryo",sans-serif; font-size:11px; color:#333; line-height:1.5; }
  .page { page-break-after: always; min-height: 100vh; position: relative; }
  .page:last-child { page-break-after: auto; }

  /* === 表紙 === */
  .cover { display:flex; flex-direction:column; justify-content:space-between; padding:20px 40px; }
  .cover-top { display:flex; justify-content:space-between; align-items:flex-start; }
  .logo { font-size:22px; font-weight:800; color:#1e40af; letter-spacing:2px; }
  .logo-infinity { font-size:28px; margin-right:6px; }
  .cover-date { font-size:13px; color:#555; text-align:right; }
  .cover-center { text-align:center; margin:30px 0 20px; }
  .cover-title { font-size:36px; font-weight:700; letter-spacing:16px; color:#1e40af; border-bottom:3px double #1e40af; display:inline-block; padding-bottom:12px; }
  .cover-customer { font-size:24px; font-weight:700; margin:28px 0 8px; text-align:center; }
  .cover-customer-suffix { font-size:16px; font-weight:400; color:#555; margin-left:8px; }
  .cover-project-info { text-align:center; font-size:14px; color:#555; margin-bottom:24px; }
  .cover-total-box { background:#f0f4ff; border:2px solid #1e40af; border-radius:10px; padding:20px 36px; margin:0 auto 30px; max-width:520px; display:flex; justify-content:space-between; align-items:center; }
  .cover-total-label { font-size:16px; font-weight:600; color:#333; }
  .cover-total-amount { font-size:34px; font-weight:800; color:#1e40af; }
  .cover-bottom { display:flex; justify-content:space-between; align-items:flex-end; }
  .cover-company { font-size:12px; line-height:1.9; }
  .cover-company-name { font-size:18px; font-weight:700; color:#1e40af; margin-bottom:4px; }
  .cover-right { display:flex; flex-direction:column; align-items:center; gap:8px; }
  .cover-staff { font-size:13px; font-weight:500; }
  .stamp-area { width:80px; height:80px; border:1px dashed #bbb; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#ccc; font-size:11px; }

  /* === テーブル共通 === */
  table { width:100%; border-collapse:collapse; }
  th { background:#1e40af; color:#fff; padding:7px 6px; font-size:11px; font-weight:600; text-align:center; border:1px solid #1e40af; }
  td { padding:5px 6px; font-size:11px; border:1px solid #e2e8f0; }
  tr:nth-child(even):not(.cat-header):not(.cat-subtotal) { background:#fafbfd; }

  /* === ページ2: サマリー === */
  .summary-page { padding:20px 30px; }
  .page-title { font-size:18px; font-weight:700; color:#1e40af; border-bottom:2px solid #1e40af; padding-bottom:6px; margin-bottom:16px; }
  .summary-table th { font-size:12px; padding:10px 8px; }
  .summary-table td { font-size:13px; }
  .summary-total td { background:#f0f4ff; font-weight:700; font-size:14px; border-top:2px solid #1e40af; }

  /* === ページ3: 明細 === */
  .detail-page { padding:20px 16px; }
  .detail-note { font-size:10px; color:#666; margin-top:16px; line-height:1.8; }
  .detail-total td { background:#f0f4ff; font-weight:700; font-size:12px; border-top:2px solid #1e40af; }

  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
  }
</style>
</head>
<body>

<!-- ========== ページ1: 表紙 ========== -->
<div class="page cover">
  <div class="cover-top">
    <div class="logo"><span class="logo-infinity">&infin;</span>LinK</div>
    <div class="cover-date">${dateStr}</div>
  </div>

  <div>
    <div class="cover-center">
      <div class="cover-title">御 見 積 書</div>
    </div>

    <div class="cover-customer">
      ${project?.customer_name ?? ""}
      <span class="cover-customer-suffix">御中</span>
    </div>

    <div class="cover-project-info">
      案件名: ${project?.project_name ?? ""}
      ${project?.site_address ? `<br>現場住所: ${project.site_address}` : ""}
    </div>

    <div class="cover-total-box">
      <span class="cover-total-label">御見積金額（税抜）</span>
      <span class="cover-total-amount">${yenFmt(total)}</span>
    </div>
  </div>

  <div class="cover-bottom">
    <div class="cover-company">
      <div class="cover-company-name">株式会社LinK</div>
      代表取締役 吉野 博<br>
      〒179-0081 東京都練馬区北町2-30-18 バロアール302<br>
      TEL: 070-8532-0024<br>
      建設業許可番号: 東京都知事（般-5）第160886号
    </div>
    <div class="cover-right">
      ${staffName ? `<div class="cover-staff">担当: ${staffName}</div>` : ""}
      <div class="stamp-area">印</div>
    </div>
  </div>
</div>

<!-- ========== ページ2: 大項目サマリー ========== -->
<div class="page summary-page">
  <div class="page-title">工事区分別 金額一覧</div>
  <table class="summary-table">
    <thead>
      <tr>
        <th style="width:50px">No</th>
        <th>工事区分</th>
        <th style="width:160px">金額</th>
      </tr>
    </thead>
    <tbody>
      ${summaryRows}
      <tr class="summary-total">
        <td colspan="2" style="text-align:right;padding-right:16px">合計（税抜）</td>
        <td style="text-align:right;color:#1e40af;font-size:16px">${yenFmt(total)}</td>
      </tr>
    </tbody>
  </table>
</div>

<!-- ========== ページ3以降: 明細 ========== -->
<div class="page detail-page">
  <div class="page-title">見積明細</div>
  <table>
    <thead>
      <tr>
        <th style="width:30px">No</th>
        <th>項目名</th>
        <th style="width:120px">仕様</th>
        <th style="width:45px">数量</th>
        <th style="width:35px">単位</th>
        <th style="width:80px">単価</th>
        <th style="width:90px">金額</th>
      </tr>
    </thead>
    <tbody>
      ${detailRows}
      <tr class="detail-total">
        <td colspan="6" style="text-align:right;padding-right:12px">総合計（税抜）</td>
        <td style="text-align:right;color:#1e40af;font-size:13px">${yenFmt(total)}</td>
      </tr>
    </tbody>
  </table>

  <div class="detail-note">
    ※ 上記金額は全て税抜価格です。別途消費税がかかります。<br>
    ※ 見積有効期限: 発行日より30日間<br>
    ※ 工事範囲・仕様の変更がある場合は別途お見積りいたします。
  </div>
</div>

</body>
</html>`;
}

// Legacy compatibility — remove these if nothing references them
export type DashboardSummary = {
  project_total: number;
  project_status_counts: Record<string, number>;
  invoice_total_amount: number;
  invoice_remaining_amount: number;
  payment_total_amount: number;
  payment_remaining_amount: number;
  item_total_amount: number;
};
