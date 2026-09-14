import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DomainError } from "./repository";

export const SLIP_ROOT = path.join(process.cwd(), "data", "private-slips");

const SAFE_ID = /^[a-zA-Z0-9._-]+$/;

export function assertSafeStorageId(value: string, label = "รหัสไฟล์") {
  if (!value || !SAFE_ID.test(value) || value.includes("..")) {
    throw new DomainError(`${label}ไม่ถูกต้อง`);
  }
}

export function slipFilePath(businessId: string, fileId: string, ext: string) {
  assertSafeStorageId(businessId, "ร้าน");
  assertSafeStorageId(fileId);
  assertSafeStorageId(ext, "นามสกุล");
  return path.join(SLIP_ROOT, businessId, `${fileId}.${ext}`);
}

export async function writePrivateSlip(
  businessId: string,
  fileId: string,
  ext: string,
  bytes: Uint8Array,
) {
  const dest = slipFilePath(businessId, fileId, ext);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, bytes);
  return dest;
}

export async function readPrivateSlip(businessId: string, fileId: string, ext: string) {
  return readFile(slipFilePath(businessId, fileId, ext));
}

export async function deletePrivateSlip(businessId: string, fileId: string, ext: string) {
  try {
    await unlink(slipFilePath(businessId, fileId, ext));
  } catch {
    // missing file is fine during cleanup
  }
}
