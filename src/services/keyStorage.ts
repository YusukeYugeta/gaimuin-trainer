import { db } from "../db";
import { deriveKey, type EncryptedFile } from "./crypto";

const REMEMBERED_KEY_META = "rememberedDecryptionKey";
const REMEMBERED_SALT_META = "rememberedDecryptionSalt";

// 「次回から省略」機能: パスフレーズそのものではなく、非抽出可能(non-extractable)な
// 派生CryptoKeyをIndexedDBに保持する。JSからは鍵の中身を読み出せない。
// データセット更新でsaltが変わった場合は不一致として再入力を求める(利便性機能のため)。
export async function rememberKey(file: EncryptedFile, passphrase: string): Promise<void> {
  const salt = file.salt;
  const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
  const key = await deriveKey(passphrase, saltBytes, file.iterations);
  await db.metadata.bulkPut([
    { key: REMEMBERED_KEY_META, value: key },
    { key: REMEMBERED_SALT_META, value: salt },
  ]);
}

export async function forgetRememberedKey(): Promise<void> {
  await db.metadata.bulkDelete([REMEMBERED_KEY_META, REMEMBERED_SALT_META]);
}

// 保存済みキーで復号を試みる。saltが一致しない/未保存ならnullを返しパスフレーズ再入力へ。
export async function tryDecryptWithRememberedKey<T>(file: EncryptedFile): Promise<T | null> {
  const [keyRow, saltRow] = await Promise.all([
    db.metadata.get(REMEMBERED_KEY_META),
    db.metadata.get(REMEMBERED_SALT_META),
  ]);
  if (!keyRow || !saltRow || saltRow.value !== file.salt) return null;
  try {
    const iv = Uint8Array.from(atob(file.iv), (c) => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(file.ciphertext), (c) => c.charCodeAt(0));
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      keyRow.value as CryptoKey,
      ciphertext as BufferSource,
    );
    return JSON.parse(new TextDecoder().decode(plainBuf)) as T;
  } catch {
    return null;
  }
}

export async function hasRememberedKey(): Promise<boolean> {
  return (await db.metadata.get(REMEMBERED_KEY_META)) !== undefined;
}
