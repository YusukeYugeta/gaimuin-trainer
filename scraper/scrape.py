#!/usr/bin/env python3
"""資格部(qe.hpeo.jp)の証券外務員一種 練習問題ページを取得する。§10

PC上で一度だけ実行する。取得元:
  クロール開始URL: https://qe.hpeo.jp/entry/sbr (証券外務員試験ナビ)
  対象: 開始ページからリンクされる /entry/sbr/eXX (2桁) 形式の分野別練習問題ページのみ。
        1分野1ページに複数問題(番号付き<li>)がまとまっている。
  対象外: /entry/sbr/eXXXX (4桁以上) の個別問題ページ。1問ずつ取得すると約700回アクセスになるため使わない。

分野ページの判定は、URLの桁数だけでなくページタイトルが
「証券外務員 練習問題 〜...〜」の形式であることでも検証する(URL体系の変更に追従しやすくするため)。
"""
from __future__ import annotations

import json
import random
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag

USER_AGENT = "gaimuin-trainer-scraper/1.0 (personal study tool; contact: owner)"
MIN_DELAY_SEC = 2.0
MAX_DELAY_SEC = 5.0
MAX_RETRIES = 5

CRAWL_START_URL = "https://qe.hpeo.jp/entry/sbr"
CATEGORY_PAGE_PATTERN = re.compile(r"/entry/sbr/e(\d{2})$")
TITLE_PATTERN = re.compile(r"練習問題\s*〜(.+?)〜")

SCRAPER_DIR = Path(__file__).parent
CACHE_DIR = SCRAPER_DIR / "output" / "cache"
RAW_OUTPUT_PATH = SCRAPER_DIR.parent / "questions.raw.json"

TRUE_MARKS = ("⭕", "○", "〇")
FALSE_MARKS = ("❌", "×", "✕")


def cache_path_for(url: str) -> Path:
    safe_name = url.replace("://", "_").replace("/", "_")[:200]
    return CACHE_DIR / f"{safe_name}.html"


def fetch_html(url: str, session: requests.Session) -> str:
    cached = cache_path_for(url)
    if cached.exists():
        return cached.read_text(encoding="utf-8")

    delay = 0.0
    for attempt in range(1, MAX_RETRIES + 1):
        if delay:
            time.sleep(delay)
        try:
            resp = session.get(url, headers={"User-Agent": USER_AGENT}, timeout=15)
            resp.raise_for_status()
            cached.parent.mkdir(parents=True, exist_ok=True)
            cached.write_text(resp.text, encoding="utf-8")
            time.sleep(random.uniform(MIN_DELAY_SEC, MAX_DELAY_SEC))
            return resp.text
        except requests.RequestException as exc:
            delay = max(delay * 2, 1.0) if delay else 2.0
            print(f"[warn] fetch failed ({attempt}/{MAX_RETRIES}) {url}: {exc}", file=sys.stderr)
    raise RuntimeError(f"{url} の取得に{MAX_RETRIES}回失敗しました")


def discover_category_urls(index_html: str, base_url: str) -> list[str]:
    soup = BeautifulSoup(index_html, "html.parser")
    seen: dict[str, None] = {}
    for a in soup.find_all("a", href=True):
        href = urljoin(base_url, a["href"])
        path = urlparse(href).path
        if CATEGORY_PAGE_PATTERN.search(path):
            clean_url = f"{urlparse(href).scheme}://{urlparse(href).netloc}{path}"
            seen[clean_url] = None
    return list(seen.keys())


def extract_category_title(html: str) -> str | None:
    soup = BeautifulSoup(html, "html.parser")
    title_tag = soup.find("title")
    if not title_tag:
        return None
    m = TITLE_PATTERN.search(title_tag.get_text())
    return m.group(1).strip() if m else None


def split_answer_mark(text: str) -> tuple[str, str]:
    """先頭の正誤記号(⭕/❌等)と、続く解説文を分離する。記号が未知の場合はそのまま返す。"""
    cleaned = text.strip().replace("️", "")
    if not cleaned:
        return "", ""
    mark, rest = cleaned[0], cleaned[1:].strip()
    return mark, rest


@dataclass
class RawQuestion:
    sourceUrl: str
    category: str
    subcategory: str
    question: str
    answerText: str
    explanation: str


def parse_category_page(html: str, page_url: str, category_name: str) -> list[RawQuestion]:
    soup = BeautifulSoup(html, "html.parser")
    content = soup.select_one(".entry-content")
    if content is None:
        return []

    entries: list[RawQuestion] = []
    for li in content.select("ol > li"):
        # 先頭2つの<p>が「見出し」「問題文」。それ以外(空の<p>等)は無視する。
        top_level_ps = [c for c in li.children if isinstance(c, Tag) and c.name == "p"]
        if len(top_level_ps) < 2:
            continue
        title_p, question_p = top_level_ps[0], top_level_ps[1]
        question_id_attr = title_p.get("id", "")
        subcategory = title_p.get_text(strip=True)
        question_text = question_p.get_text(" ", strip=True)

        details = li.find("details")
        maru_texts = [p.get_text(strip=True) for p in details.select("p.maru")] if details else []
        maru_texts = [t for t in maru_texts if t]
        if not maru_texts:
            continue
        mark, explanation = split_answer_mark(maru_texts[0])
        answer_text = mark if mark in TRUE_MARKS or mark in FALSE_MARKS else maru_texts[0]

        anchor = f"#{question_id_attr}" if question_id_attr else ""
        entries.append(
            RawQuestion(
                sourceUrl=f"{page_url}{anchor}",
                category=category_name,
                subcategory=subcategory,
                question=question_text,
                answerText=answer_text,
                explanation=explanation,
            )
        )
    return entries


def main() -> None:
    session = requests.Session()
    print(f"fetching index: {CRAWL_START_URL}")
    index_html = fetch_html(CRAWL_START_URL, session)
    category_urls = discover_category_urls(index_html, CRAWL_START_URL)
    print(f"found {len(category_urls)} candidate category pages")

    all_entries: list[RawQuestion] = []
    skipped: list[str] = []
    for i, url in enumerate(category_urls, 1):
        print(f"[{i}/{len(category_urls)}] fetching {url}")
        html = fetch_html(url, session)
        category_name = extract_category_title(html)
        if not category_name:
            skipped.append(url)
            print(f"  [skip] タイトルが分野ページの形式ではありません: {url}", file=sys.stderr)
            continue
        entries = parse_category_page(html, url, category_name)
        print(f"  -> {category_name}: {len(entries)}問")
        all_entries.extend(entries)

    RAW_OUTPUT_PATH.write_text(
        json.dumps([e.__dict__ for e in all_entries], ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"wrote {len(all_entries)} raw entries to {RAW_OUTPUT_PATH}")
    if skipped:
        print(f"skipped {len(skipped)} non-category pages: {skipped}", file=sys.stderr)


if __name__ == "__main__":
    main()
