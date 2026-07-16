export interface Category {
  id: string;
  name: string;
}

// 内部IDは固定。表示名(name)の変更は履歴に影響しない。
export const CATEGORIES: Category[] = [
  { id: "market-basics", name: "証券市場の基礎知識" },
  { id: "financial-instruments-law", name: "金商法" },
  { id: "solicitation-law", name: "勧誘・販売法律" },
  { id: "association-rules", name: "協会定款" },
  { id: "exchange-rules", name: "取引所定款" },
  { id: "equity-business", name: "株式業務" },
  { id: "bond-business", name: "債券業務" },
  { id: "fund-reit", name: "投信・投資法人" },
  { id: "ancillary-business", name: "付随業務" },
  { id: "derivatives", name: "デリバティブ" },
  { id: "corporate-law", name: "会社法" },
  { id: "economy-finance-fiscal", name: "経済・金融・財政" },
  { id: "financial-statements", name: "財務諸表" },
  { id: "securities-taxation", name: "証券税制" },
];

export const CATEGORY_MAP: Record<string, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
);

export function categoryName(id: string): string {
  return CATEGORY_MAP[id]?.name ?? id;
}
