// @vitest-environment node
import { describe, expect, it } from "vitest";
import { decryptToJson, encryptJson, DecryptionError } from "../src/services/crypto";

describe("crypto roundtrip", () => {
  it("encrypts and decrypts JSON with the correct passphrase", async () => {
    const data = { hello: "world", n: 42 };
    const file = await encryptJson(data, "correct-horse-battery-staple", 1000);
    const decrypted = await decryptToJson<typeof data>(file, "correct-horse-battery-staple");
    expect(decrypted).toEqual(data);
  });

  it("throws DecryptionError with a wrong passphrase", async () => {
    const file = await encryptJson({ a: 1 }, "right-pass", 1000);
    await expect(decryptToJson(file, "wrong-pass")).rejects.toBeInstanceOf(DecryptionError);
  });

  it("throws DecryptionError on a tampered ciphertext", async () => {
    const file = await encryptJson({ a: 1 }, "pass", 1000);
    const tampered = { ...file, ciphertext: file.ciphertext.slice(0, -4) + "AAAA" };
    await expect(decryptToJson(tampered, "pass")).rejects.toBeInstanceOf(DecryptionError);
  });
});
