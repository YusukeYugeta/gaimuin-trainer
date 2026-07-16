// AES-GCM + PBKDF2 によるブラウザ内暗号化/復号。§11
export interface EncryptedFile {
  version: number;
  algorithm: "AES-GCM";
  kdf: "PBKDF2";
  iterations: number;
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
}

export class DecryptionError extends Error {
  constructor() {
    // §5.1: 復号失敗時は原因を詳細表示しない
    super("復号に失敗しました");
    this.name = "DecryptionError";
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt", "encrypt"],
  );
}

export async function decryptToJson<T>(file: EncryptedFile, passphrase: string): Promise<T> {
  if (file.algorithm !== "AES-GCM" || file.kdf !== "PBKDF2") {
    throw new DecryptionError();
  }
  try {
    const salt = base64ToBytes(file.salt);
    const iv = base64ToBytes(file.iv);
    const ciphertext = base64ToBytes(file.ciphertext);
    const key = await deriveKey(passphrase, salt, file.iterations);
    const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ciphertext as BufferSource);
    const json = new TextDecoder().decode(plainBuf);
    return JSON.parse(json) as T;
  } catch {
    // 認証タグ検証失敗・パスフレーズ不正・JSON不正はすべて同じ扱い(詳細を出さない)
    throw new DecryptionError();
  }
}

// テスト・開発用の暗号化(本番データは scraper/encrypt.py が生成する)
export async function encryptJson(data: unknown, passphrase: string, iterations = 250_000): Promise<EncryptedFile> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, plaintext as BufferSource),
  );
  return {
    version: 1,
    algorithm: "AES-GCM",
    kdf: "PBKDF2",
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
  };
}
