import { DomainError } from "./repository";

export function sniffImage(bytes: Uint8Array): { mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" } {
  if (bytes.byteLength > 6_000_000) throw new DomainError("ไฟล์ใหญ่เกิน 6MB");
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { mime: "image/png", ext: "png" };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  throw new DomainError("ใช้ไฟล์ JPG/PNG/WEBP เท่านั้น");
}
