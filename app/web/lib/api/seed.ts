// ============================================================
// LinK Estimate OS — Seed Data for New Organizations
// 初回ログイン時に work_items と estimate_templates を自動投入
// ============================================================

import { createClient } from "../supabase/client";

type SeedWorkItem = {
  category: string;
  item_name: string;
  specification?: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  sort_order: number;
};

const SEED_WORK_ITEMS: SeedWorkItem[] = [
  // 畳・襖・障子
  { category: "畳・襖", item_name: "畳表替え", unit: "枚", cost_price: 3900, selling_price: 6500, sort_order: 0 },
  { category: "畳・襖", item_name: "畳新調", unit: "枚", cost_price: 9500, selling_price: 15000, sort_order: 1 },
  { category: "畳・襖", item_name: "襖張替え（両面）", unit: "枚", cost_price: 4000, selling_price: 7000, sort_order: 2 },
  { category: "畳・襖", item_name: "障子張替え", unit: "枚", cost_price: 2500, selling_price: 4500, sort_order: 3 },
  { category: "畳・襖", item_name: "網戸張替え", unit: "枚", cost_price: 3000, selling_price: 5000, sort_order: 4 },
  // 内装
  { category: "内装", item_name: "クロス貼替（量産）", unit: "m2", cost_price: 850, selling_price: 1400, sort_order: 10 },
  { category: "内装", item_name: "クロス貼替（1000番台）", unit: "m2", cost_price: 1100, selling_price: 1800, sort_order: 11 },
  { category: "内装", item_name: "CF貼替", unit: "m2", cost_price: 2800, selling_price: 4500, sort_order: 12 },
  { category: "内装", item_name: "フロアタイル貼り", unit: "m2", cost_price: 3500, selling_price: 5500, sort_order: 13 },
  { category: "内装", item_name: "巾木交換", unit: "m", cost_price: 600, selling_price: 1000, sort_order: 14 },
  { category: "内装", item_name: "ソフト巾木貼替", unit: "m", cost_price: 400, selling_price: 700, sort_order: 15 },
  { category: "内装", item_name: "天井クロス貼替（量産）", unit: "m2", cost_price: 900, selling_price: 1500, sort_order: 16 },
  { category: "内装", item_name: "アクセントクロス（1000番台）", unit: "m2", cost_price: 1200, selling_price: 2000, sort_order: 17 },
  { category: "内装", item_name: "カーペット張替え", unit: "m2", cost_price: 3000, selling_price: 5000, sort_order: 18 },
  { category: "内装", item_name: "長尺シート貼り", unit: "m2", cost_price: 3500, selling_price: 5800, sort_order: 19 },
  // 塗装
  { category: "塗装", item_name: "室内塗装（壁）", unit: "m2", cost_price: 1200, selling_price: 2000, sort_order: 20 },
  { category: "塗装", item_name: "外壁塗装", unit: "m2", cost_price: 2500, selling_price: 4200, sort_order: 21 },
  { category: "塗装", item_name: "木部塗装", unit: "m2", cost_price: 1800, selling_price: 3000, sort_order: 22 },
  // 設備
  { category: "設備", item_name: "トイレ交換", unit: "台", cost_price: 45000, selling_price: 85000, sort_order: 30 },
  { category: "設備", item_name: "洗面台交換", unit: "台", cost_price: 35000, selling_price: 65000, sort_order: 31 },
  { category: "設備", item_name: "混合水栓交換", unit: "箇所", cost_price: 15000, selling_price: 28000, sort_order: 32 },
  { category: "設備", item_name: "給湯器交換", unit: "台", cost_price: 85000, selling_price: 150000, sort_order: 33 },
  { category: "設備", item_name: "シャワー水栓交換", unit: "箇所", cost_price: 12000, selling_price: 22000, sort_order: 34 },
  { category: "設備", item_name: "排水管洗浄", unit: "式", cost_price: 8000, selling_price: 15000, sort_order: 35 },
  { category: "設備", item_name: "キッチン交換（ミニ）", unit: "台", cost_price: 80000, selling_price: 140000, sort_order: 36 },
  { category: "設備", item_name: "キッチン交換（システム）", unit: "台", cost_price: 250000, selling_price: 400000, sort_order: 37 },
  { category: "設備", item_name: "ウォシュレット交換", unit: "台", cost_price: 25000, selling_price: 45000, sort_order: 38 },
  { category: "設備", item_name: "エアコン取付（新規）", unit: "台", cost_price: 15000, selling_price: 28000, sort_order: 39 },
  { category: "設備", item_name: "エアコン交換", unit: "台", cost_price: 55000, selling_price: 95000, sort_order: 40 },
  { category: "設備", item_name: "換気扇交換（キッチン）", unit: "台", cost_price: 10000, selling_price: 18000, sort_order: 41 },
  // 電気
  { category: "電気", item_name: "照明器具交換", unit: "箇所", cost_price: 5000, selling_price: 9000, sort_order: 50 },
  { category: "電気", item_name: "コンセント増設", unit: "箇所", cost_price: 8000, selling_price: 15000, sort_order: 51 },
  { category: "電気", item_name: "分電盤交換", unit: "台", cost_price: 35000, selling_price: 60000, sort_order: 52 },
  // 大工
  { category: "大工", item_name: "床張替え（フローリング）", unit: "m2", cost_price: 6000, selling_price: 9500, sort_order: 60 },
  { category: "大工", item_name: "建具調整", unit: "箇所", cost_price: 5000, selling_price: 8000, sort_order: 61 },
  { category: "大工", item_name: "棚造作", unit: "箇所", cost_price: 15000, selling_price: 25000, sort_order: 62 },
  // 建具
  { category: "建具", item_name: "室内ドア交換", unit: "枚", cost_price: 20000, selling_price: 35000, sort_order: 70 },
  { category: "建具", item_name: "クローゼット扉交換", unit: "枚", cost_price: 15000, selling_price: 28000, sort_order: 71 },
  { category: "建具", item_name: "玄関ドア調整", unit: "式", cost_price: 5000, selling_price: 10000, sort_order: 72 },
  { category: "建具", item_name: "ドアクローザー交換", unit: "台", cost_price: 8000, selling_price: 15000, sort_order: 73 },
  // クリーニング
  { category: "クリーニング", item_name: "ハウスクリーニング（1K）", unit: "式", cost_price: 22000, selling_price: 35000, sort_order: 80 },
  { category: "クリーニング", item_name: "ハウスクリーニング（2DK）", unit: "式", cost_price: 35000, selling_price: 55000, sort_order: 81 },
  { category: "クリーニング", item_name: "ハウスクリーニング（3LDK）", unit: "式", cost_price: 45000, selling_price: 70000, sort_order: 82 },
  { category: "クリーニング", item_name: "エアコンクリーニング", unit: "台", cost_price: 8000, selling_price: 15000, sort_order: 83 },
  { category: "クリーニング", item_name: "水回りクリーニング", unit: "式", cost_price: 15000, selling_price: 25000, sort_order: 84 },
  // 外装
  { category: "外装", item_name: "屋根塗装", unit: "m2", cost_price: 2200, selling_price: 3800, sort_order: 90 },
  { category: "外装", item_name: "雨樋交換", unit: "m", cost_price: 3000, selling_price: 5500, sort_order: 91 },
  { category: "外装", item_name: "シーリング打替え", unit: "m", cost_price: 800, selling_price: 1500, sort_order: 92 },
  { category: "外装", item_name: "ベランダ防水", unit: "m2", cost_price: 4000, selling_price: 7000, sort_order: 93 },
  // 防犯・安全
  { category: "防犯・安全", item_name: "鍵交換（シリンダー）", unit: "箇所", cost_price: 8000, selling_price: 15000, sort_order: 100 },
  { category: "防犯・安全", item_name: "インターホン交換", unit: "台", cost_price: 12000, selling_price: 22000, sort_order: 101 },
  { category: "防犯・安全", item_name: "火災報知器交換", unit: "台", cost_price: 4000, selling_price: 8000, sort_order: 102 },
  { category: "防犯・安全", item_name: "手すり取付", unit: "箇所", cost_price: 8000, selling_price: 15000, sort_order: 103 },
  // 解体・撤去
  { category: "解体・撤去", item_name: "残置物撤去（1R分）", unit: "式", cost_price: 30000, selling_price: 50000, sort_order: 110 },
  { category: "解体・撤去", item_name: "残置物撤去（2DK分）", unit: "式", cost_price: 50000, selling_price: 80000, sort_order: 111 },
  { category: "解体・撤去", item_name: "エアコン撤去", unit: "台", cost_price: 5000, selling_price: 10000, sort_order: 112 },
  // 諸経費
  { category: "諸経費", item_name: "現場管理費", unit: "式", cost_price: 0, selling_price: 15000, sort_order: 120 },
  { category: "諸経費", item_name: "廃棄物処理", unit: "式", cost_price: 15000, selling_price: 25000, sort_order: 121 },
  { category: "諸経費", item_name: "養生費", unit: "式", cost_price: 5000, selling_price: 10000, sort_order: 122 },
];

const SEED_TEMPLATES = [
  {
    name: "1K 原状回復",
    description: "ワンルーム・1Kの基本原状回復パック（5項目）",
    keywords: ["1K", "1R", "ワンルーム", "原状回復"],
    items: [
      { category: "内装", item_name: "クロス貼替（量産）", unit: "m2", quantity: 40, cost_price: 850, selling_price: 1400 },
      { category: "内装", item_name: "CF貼替", unit: "m2", quantity: 10, cost_price: 2800, selling_price: 4500 },
      { category: "クリーニング", item_name: "ハウスクリーニング（1K）", unit: "式", quantity: 1, cost_price: 22000, selling_price: 35000 },
      { category: "諸経費", item_name: "現場管理費", unit: "式", quantity: 1, cost_price: 0, selling_price: 15000 },
      { category: "諸経費", item_name: "廃棄物処理", unit: "式", quantity: 1, cost_price: 15000, selling_price: 25000 },
    ],
  },
  {
    name: "2DK 原状回復",
    description: "2DKの標準原状回復パック・畳襖含む（7項目）",
    keywords: ["2DK", "2K", "原状回復"],
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
    name: "3DK 原状回復",
    description: "3DKの標準原状回復パック・和室あり（8項目）",
    keywords: ["3DK", "3K", "原状回復"],
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
    name: "外壁塗装パック",
    description: "戸建外壁塗装の基本セット（4項目）",
    keywords: ["外壁", "塗装", "外装"],
    items: [
      { category: "塗装", item_name: "外壁塗装", unit: "m2", quantity: 120, cost_price: 2500, selling_price: 4200 },
      { category: "塗装", item_name: "木部塗装", unit: "m2", quantity: 25, cost_price: 1800, selling_price: 3000 },
      { category: "諸経費", item_name: "養生費", unit: "式", quantity: 1, cost_price: 5000, selling_price: 10000 },
      { category: "諸経費", item_name: "廃棄物処理", unit: "式", quantity: 1, cost_price: 15000, selling_price: 25000 },
    ],
  },
  {
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

export async function seedOrganizationData(orgId: string): Promise<void> {
  const sb = createClient();

  // work_items が既にあればスキップ
  const { count } = await sb
    .from("work_items")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);

  if (count && count > 0) return;

  // work_items 投入
  const workItemRows = SEED_WORK_ITEMS.map((item) => ({
    org_id: orgId,
    ...item,
  }));
  await sb.from("work_items").insert(workItemRows);

  // estimate_templates 投入
  const templateRows = SEED_TEMPLATES.map((tpl) => ({
    org_id: orgId,
    name: tpl.name,
    description: tpl.description,
    keywords: tpl.keywords,
    items: tpl.items,
  }));
  await sb.from("estimate_templates").insert(templateRows);
}
