import { cookies } from "next/headers";
import crypto from "node:crypto";

const ADMIN_COOKIE_NAME = "loan_admin_session";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "loan-admin-secret";

function signToken(payload) {
  return crypto.createHmac("sha256", ADMIN_SESSION_SECRET).update(payload).digest("hex");
}

export function createAdminToken() {
  const payload = "authenticated";
  return `${payload}.${signToken(payload)}`;
}

export function validateAdminToken(token) {
  if (!token) return false;
  const [payload, signature] = String(token).split(".");
  if (!payload || !signature) return false;
  return signToken(payload) === signature;
}

export function isAdminPasswordValid(password) {
  return Boolean(ADMIN_PASSWORD) && password === ADMIN_PASSWORD;
}

export function requireAdminConfigured() {
  if (!ADMIN_PASSWORD) {
    throw new Error("ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.");
  }
}

export async function isAdminAuthenticated() {
  const store = cookies();
  const token = store.get(ADMIN_COOKIE_NAME)?.value;
  return validateAdminToken(token);
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export { ADMIN_COOKIE_NAME };
