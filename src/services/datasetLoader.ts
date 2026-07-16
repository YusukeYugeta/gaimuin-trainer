import { decryptToJson, DecryptionError, type EncryptedFile } from "./crypto";
import { rememberKey, tryDecryptWithRememberedKey } from "./keyStorage";
import { loadQuestionsDataset, type QuestionsDataset } from "../db/repo";

const DATA_URL = `${import.meta.env.BASE_URL}data/questions.enc`;

function isEncryptedFile(v: unknown): v is EncryptedFile {
  if (typeof v !== "object" || v === null) return false;
  const f = v as Record<string, unknown>;
  return (
    f.algorithm === "AES-GCM" &&
    f.kdf === "PBKDF2" &&
    typeof f.salt === "string" &&
    typeof f.iv === "string" &&
    typeof f.ciphertext === "string"
  );
}

function isQuestionsDataset(v: unknown): v is QuestionsDataset {
  if (typeof v !== "object" || v === null) return false;
  const d = v as Record<string, unknown>;
  return typeof d.schemaVersion === "number" && Array.isArray(d.questions) && d.questions.length > 0;
}

export class DatasetFetchError extends Error {}

export async function fetchEncryptedFile(): Promise<EncryptedFile> {
  let res: Response;
  try {
    res = await fetch(DATA_URL, { cache: "no-cache" });
  } catch {
    throw new DatasetFetchError("問題データを取得できませんでした");
  }
  if (!res.ok) throw new DatasetFetchError("問題データを取得できませんでした");
  const json = await res.json();
  if (!isEncryptedFile(json)) throw new DatasetFetchError("問題データの形式が不正です");
  return json;
}

// 保存済みキーがあれば無言で復号を試みる。失敗/未保存ならnull。
export async function tryAutoUnlock(file: EncryptedFile): Promise<boolean> {
  const dataset = await tryDecryptWithRememberedKey<unknown>(file);
  if (!dataset || !isQuestionsDataset(dataset)) return false;
  await loadQuestionsDataset(dataset);
  return true;
}

export async function unlockWithPassphrase(
  file: EncryptedFile,
  passphrase: string,
  remember: boolean,
): Promise<void> {
  const raw = await decryptToJson<unknown>(file, passphrase);
  if (!isQuestionsDataset(raw)) throw new DecryptionError();
  await loadQuestionsDataset(raw);
  if (remember) await rememberKey(file, passphrase);
}
