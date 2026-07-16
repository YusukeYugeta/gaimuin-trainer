#!/usr/bin/env python3
"""正規化済みデータのバリデーション。§10"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.parse import urlparse

from categories import CATEGORY_IDS

SCRAPER_DIR = Path(__file__).parent
OUTPUT_DIR = SCRAPER_DIR / "output"
NORMALIZED_PATH = OUTPUT_DIR / "questions.normalized.json"
VALID_PATH = OUTPUT_DIR / "questions.valid.json"

REQUIRED_FIELDS = [
    "id",
    "source",
    "sourceUrl",
    "categoryId",
    "question",
    "answer",
    "explanation",
    "contentHash",
    "scrapedAt",
]


def is_valid_url(url: str) -> bool:
    parsed = urlparse(url)
    return bool(parsed.scheme) and bool(parsed.netloc)


def validate_question(q: dict) -> list[str]:
    errors = []
    for field in REQUIRED_FIELDS:
        if field not in q or q[field] in (None, ""):
            errors.append(f"{q.get('id', '?')}: 必須フィールド不足 ({field})")
    if not isinstance(q.get("question"), str) or not q["question"].strip():
        errors.append(f"{q.get('id', '?')}: 問題文が空です")
    if not isinstance(q.get("explanation"), str) or not q["explanation"].strip():
        errors.append(f"{q.get('id', '?')}: 解説が空です")
    if not isinstance(q.get("answer"), bool):
        errors.append(f"{q.get('id', '?')}: 正解が○×判定できません")
    if q.get("categoryId") not in CATEGORY_IDS:
        errors.append(f"{q.get('id', '?')}: 未知の分野ID ({q.get('categoryId')})")
    if not is_valid_url(q.get("sourceUrl", "")):
        errors.append(f"{q.get('id', '?')}: URLが不正です ({q.get('sourceUrl')})")
    return errors


def main() -> None:
    if not NORMALIZED_PATH.exists():
        raise SystemExit(f"{NORMALIZED_PATH} が見つかりません。先に normalize.py を実行してください。")

    questions = json.loads(NORMALIZED_PATH.read_text(encoding="utf-8"))

    errors: list[str] = []
    ids_seen: set[str] = set()
    for q in questions:
        errors.extend(validate_question(q))
        qid = q.get("id")
        if qid in ids_seen:
            errors.append(f"ID重複: {qid}")
        elif qid:
            ids_seen.add(qid)

    if errors:
        print(f"{len(errors)} 件のバリデーションエラー:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        raise SystemExit(1)

    if not questions:
        raise SystemExit("問題件数が0件です。")

    VALID_PATH.write_text(json.dumps(questions, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"validated {len(questions)} questions -> {VALID_PATH}")


if __name__ == "__main__":
    main()
