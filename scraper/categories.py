"""14分野の内部ID定義。src/domain/categories.ts と一致させること。"""

CATEGORIES = [
    {"id": "market-basics", "name": "証券市場の基礎知識"},
    {"id": "financial-instruments-law", "name": "金商法"},
    {"id": "solicitation-law", "name": "勧誘・販売法律"},
    {"id": "association-rules", "name": "協会定款"},
    {"id": "exchange-rules", "name": "取引所定款"},
    {"id": "equity-business", "name": "株式業務"},
    {"id": "bond-business", "name": "債券業務"},
    {"id": "fund-reit", "name": "投信・投資法人"},
    {"id": "ancillary-business", "name": "付随業務"},
    {"id": "derivatives", "name": "デリバティブ"},
    {"id": "corporate-law", "name": "会社法"},
    {"id": "economy-finance-fiscal", "name": "経済・金融・財政"},
    {"id": "financial-statements", "name": "財務諸表"},
    {"id": "securities-taxation", "name": "証券税制"},
]

CATEGORY_IDS = {c["id"] for c in CATEGORIES}
NAME_TO_ID = {c["name"]: c["id"] for c in CATEGORIES}

# qe.hpeo.jp (資格部) の分野ページ17件 -> 内部14分野への明示マッピング。
# https://qe.hpeo.jp/entry/sbr 配下の各 /entry/sbr/eXX ページタイトルから抽出した分野名がキー。
SOURCE_CATEGORY_ALIASES: dict[str, str] = {
    "証券市場の基礎知識": "market-basics",
    "金融商品取引法及び関係法令": "financial-instruments-law",
    "金融商品の勧誘・販売に関係する法律": "solicitation-law",
    "協会定款・諸規則": "association-rules",
    "取引所定款・諸規則": "exchange-rules",
    "株式業務": "equity-business",
    "債券業務": "bond-business",
    "投資信託及び投資法人に関する業務": "fund-reit",
    "付随業務": "ancillary-business",
    "セールス業務": "solicitation-law",  # 外務員の勧誘倫理・販売姿勢が主題のため勧誘・販売法律に統合
    "株式会社法概論": "corporate-law",
    "経済・金融・財政の常識": "economy-finance-fiscal",
    "財務諸表と企業分析": "financial-statements",
    "証券税制": "securities-taxation",
    "先物取引": "derivatives",
    "オプション取引": "derivatives",
    "特定店頭デリバティブ取引": "derivatives",
}


def normalize_category(raw_name: str) -> str | None:
    """取得元の分類名からカテゴリIDへ正規化する。

    既知の資格部の分野名は明示マッピングで解決する。未知の名前は部分一致で救済を試み、
    それでも一致しなければNone(要手動マッピング・バリデーションでエラーとして報告)。
    """
    raw_name = raw_name.strip()
    if raw_name in SOURCE_CATEGORY_ALIASES:
        return SOURCE_CATEGORY_ALIASES[raw_name]
    if raw_name in NAME_TO_ID:
        return NAME_TO_ID[raw_name]
    for name, cid in NAME_TO_ID.items():
        if name in raw_name or raw_name in name:
            return cid
    return None
