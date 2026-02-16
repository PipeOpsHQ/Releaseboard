import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ADMIN_COOKIE = "pipeops_admin_session";
const ADMIN_PAYLOAD = "admin";

function getSessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET ?? "pipeops-admin-session-secret-change-me";
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function expectedCookieValue(): string {
  return `${ADMIN_PAYLOAD}.${sign(ADMIN_PAYLOAD)}`;
}

export function isAdminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

export async function isAdminAuthenticated(): Promise<boolean> {
  if (!isAdminPasswordConfigured()) {
    return true;
  }

  const store = await cookies();
  const session = store.get(ADMIN_COOKIE)?.value;
  if (!session) {
    return false;
  }

  const expected = expectedCookieValue();
  const actualBuffer = Buffer.from(session);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function requireAdminOrThrow(): Promise<void> {
  const authenticated = await isAdminAuthenticated();
  if (!authenticated) {
    redirect("/admin");
  }
}

export async function loginAdmin(password: string): Promise<boolean> {
  const expectedPassword = process.env.ADMIN_PASSWORD?.trim();

  if (!expectedPassword) {
    return true;
  }

  const supplied = password.trim();
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expectedPassword);

  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    return false;
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE, expectedCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });

  return true;
}

export async function logoutAdmin(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
