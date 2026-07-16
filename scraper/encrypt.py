#!/usr/bin/env python3
"""検証済み問題データをAES-GCMで暗号化してquestions.encを生成する。§11

パスフレーズは環境変数 GAIMUIN_PASSPHRASE か、対話プロンプトで入力する。
リポジトリには一切保存しない。
"""
from __future__ import annotations

import base64
import getpass
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

SCRAPER_DIR = Path(__file__).parent
OUTPUT_DIR = SCRAPER_DIR / "output"
VALID_PATH = OUTPUT_DIR / "questions.valid.json"
PREV_HASHES_PATH = OUTPUT_DIR / "questions.prevhashes.json"
ENC_OUTPUT_PATH = SCRAPER_DIR.parent / "public" / "data" / "questions.enc"

ITERATIONS = 250_000
SCHEMA_VERSION = 1


def derive_key(passphrase: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERATIONS)
    return kdf.derive(passphrase.encode("utf-8"))


def log_diff(questions: list[dict]) -> None:
    prev: dict[str, str] = {}
    if PREV_HASHES_PATH.exists():
        prev = json.loads(PREV_HASHES_PATH.read_text(encoding="utf-8"))

    current = {q["id"]: q["contentHash"] for q in questions}
    added = [qid for qid in current if qid not in prev]
    removed = [qid for qid in prev if qid not in current]
    changed = [qid for qid in current if qid in prev and prev[qid] != current[qid]]

    print(f"diff: +{len(added)} -{len(removed)} ~{len(changed)}")
    for qid in added:
        print(f"  [new] {qid}")
    for qid in removed:
        print(f"  [removed] {qid}")
    for qid in changed:
        print(f"  [changed] {qid}")

    PREV_HASHES_PATH.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    if not VALID_PATH.exists():
        raise SystemExit(f"{VALID_PATH} が見つかりません。先に validate.py を実行してください。")

    questions = json.loads(VALID_PATH.read_text(encoding="utf-8"))
    if not questions:
        raise SystemExit("問題件数が0件のため中止します。")

    log_diff(questions)

    dataset = {
        "schemaVersion": SCHEMA_VERSION,
        "datasetVersion": datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"),
        "questionCount": len(questions),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "questions": questions,
    }

    passphrase = os.environ.get("GAIMUIN_PASSPHRASE") or getpass.getpass("暗号化パスフレーズ: ")
    if not passphrase:
        raise SystemExit("パスフレーズが空です。")

    salt = os.urandom(16)
    iv = os.urandom(12)
    key = derive_key(passphrase, salt)
    plaintext = json.dumps(dataset, ensure_ascii=False).encode("utf-8")
    ciphertext = AESGCM(key).encrypt(iv, plaintext, None)

    encrypted_file = {
        "version": 1,
        "algorithm": "AES-GCM",
        "kdf": "PBKDF2",
        "iterations": ITERATIONS,
        "salt": base64.b64encode(salt).decode("ascii"),
        "iv": base64.b64encode(iv).decode("ascii"),
        "ciphertext": base64.b64encode(ciphertext).decode("ascii"),
    }

    ENC_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    ENC_OUTPUT_PATH.write_text(json.dumps(encrypted_file), encoding="utf-8")
    print(f"wrote {len(questions)} questions ({len(plaintext)} bytes plaintext) -> {ENC_OUTPUT_PATH}")


if __name__ == "__main__":
    main()
