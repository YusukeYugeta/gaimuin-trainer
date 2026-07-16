// @vitest-environment node
// CIの「復号テスト失敗」「問題件数0」ゲート。GAIMUIN_PASSPHRASE未設定時はスキップする。
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decryptToJson } from "../src/services/crypto";

const encPath = path.resolve(__dirname, "../public/data/questions.enc");
const passphrase = process.env.GAIMUIN_PASSPHRASE;
const shouldRun = existsSync(encPath) && !!passphrase;

describe.skipIf(!shouldRun)("questions.enc (production data)", () => {
  it("decrypts with GAIMUIN_PASSPHRASE and contains at least one question", async () => {
    const file = JSON.parse(readFileSync(encPath, "utf-8"));
    const dataset = await decryptToJson<{ questions: unknown[]; questionCount: number }>(file, passphrase!);
    expect(Array.isArray(dataset.questions)).toBe(true);
    expect(dataset.questions.length).toBeGreaterThan(0);
  });
});
