#!/usr/bin/env python3
"""questions.raw.json を正規化してQuestionモデルに変換する。§10"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from categories import normalize_category

SCRAPER_DIR = Path(__file__).parent
RAW_PATH = SCRAPER_DIR.parent / "questions.raw.json"
OUTPUT_DIR = SCRAPER_DIR / "output"
NORMALIZED_PATH = OUTPUT_DIR / "questions.normalized.json"

TRUE_TOKENS = {"○", "〇", "⭕", "まる", "true", "正しい", "適切"}
FALSE_TOKENS = {"×", "✕", "✗", "❌", "ばつ", "false", "誤り", "不適切"}


def parse_answer(raw: str) -> bool | None:
    text = raw.strip().lower()
    if text in TRUE_TOKENS:
        return True
    if text in FALSE_TOKENS:
        return False
    for t in TRUE_TOKENS:
        if t in text:
            return True
    for f in FALSE_TOKENS:
        if f in text:
            return False
    return None


def source_page_id(url: str) -> str:
    parsed = urlparse(url)
    path = parsed.path.rstrip("/")
    segment = path.rsplit("/", 1)[-1] if path else ""
    segment = re.sub(r"[^a-zA-Z0-9_-]", "", segment)
    # 分野まとめページでは1URLに複数問題が含まれるため、フラグメント(#設問番号)で一意化する。
    if parsed.fragment:
        frag = re.sub(r"[^a-zA-Z0-9_-]", "", parsed.fragment)
        segment = f"{segment}-{frag}" if segment else frag
    return segment or hashlib.sha1(url.encode("utf-8")).hexdigest()[:10]


def content_hash(question: str, explanation: str, answer: bool) -> str:
    payload = f"{question}|{explanation}|{answer}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def normalize_entry(raw: dict, scraped_at: str) -> tuple[dict | None, str | None]:
    category_id = normalize_category(raw.get("category", ""))
    if category_id is None:
        return None, f"分野を正規化できません: {raw.get('category')!r} ({raw.get('sourceUrl')})"

    question = (raw.get("question") or "").strip()
    explanation = (raw.get("explanation") or "").strip()
    if not question:
        return None, f"問題文が空です ({raw.get('sourceUrl')})"

    answer = parse_answer(raw.get("answerText", ""))
    if answer is None:
        return None, f"正解を判定できません: {raw.get('answerText')!r} ({raw.get('sourceUrl')})"

    page_id = source_page_id(raw["sourceUrl"])
    question_id = f"{category_id}-{page_id}"
    subcategory = (raw.get("subcategory") or "").strip() or None

    normalized = {
        "id": question_id,
        "source": urlparse(raw["sourceUrl"]).netloc,
        "sourceUrl": raw["sourceUrl"],
        "categoryId": category_id,
        "subcategoryId": subcategory,
        "question": question,
        "answer": answer,
        "explanation": explanation,
        "tags": [subcategory] if subcategory else [],
        "active": True,
        "contentHash": content_hash(question, explanation, answer),
        "scrapedAt": scraped_at,
    }
    return normalized, None


def main() -> None:
    if not RAW_PATH.exists():
        raise SystemExit(f"{RAW_PATH} が見つかりません。先に scrape.py を実行してください。")

    raw_entries = json.loads(RAW_PATH.read_text(encoding="utf-8"))
    scraped_at = datetime.now(timezone.utc).isoformat()

    normalized: list[dict] = []
    errors: list[str] = []
    seen_ids: set[str] = set()

    for entry in raw_entries:
        result, error = normalize_entry(entry, scraped_at)
        if error:
            errors.append(error)
            continue
        assert result is not None
        if result["id"] in seen_ids:
            errors.append(f"ID重複: {result['id']}")
            continue
        seen_ids.add(result["id"])
        normalized.append(result)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    NORMALIZED_PATH.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"normalized {len(normalized)} questions -> {NORMALIZED_PATH}")

    if errors:
        print(f"\n{len(errors)} 件のエラー:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
