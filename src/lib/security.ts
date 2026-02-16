import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

function getKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY ?? "pipeops-local-dev-key-change-me";
  return createHash("sha256").update(secret).digest();
}

export function encryptToken(token: string | null | undefined): string | null {
  if (!token) {
    return null;
  }

  const value = token.trim();
  if (!value) {
    return null;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptToken(encrypted: string | null | undefined): string | null {
  if (!encrypted) {
    return null;
  }

  if (!encrypted.startsWith(`${VERSION}:`)) {
    return encrypted;
  }

  const [, ivEncoded, tagEncoded, payloadEncoded] = encrypted.split(":");
  if (!ivEncoded || !tagEncoded || !payloadEncoded) {
    return null;
  }

  try {
    const iv = Buffer.from(ivEncoded, "base64url");
    const tag = Buffer.from(tagEncoded, "base64url");
    const payload = Buffer.from(payloadEncoded, "base64url");

    const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}
