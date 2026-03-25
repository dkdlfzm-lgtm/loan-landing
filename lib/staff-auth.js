import { cookies } from "next/headers";
import crypto from "node:crypto";

const STAFF_COOKIE_NAME = "loan_staff_session";
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || process.env.EMPLOYEE_PASSWORD || process.env.ADMIN_PASSWORD || "";
const STAFF_SESSION_SECRET = process.env.STAFF_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || "loan-staff-secret";

function signToken(payload) {
  return crypto.createHmac("sha256", STAFF_SESSION_SECRET).update(payload).digest("hex");
}

export function createStaffToken() {
  const payload = "staff-authenticated";
  return `${payload}.${signToken(payload)}`;
}

export function validateStaffToken(token) {
  if (!token) return false;
  const [payload, signature] = String(token).split(".");
  if (!payload || !signature) return false;
  return signToken(payload) === signature;
}

export function isStaffPasswordValid(password) {
  return Boolean(STAFF_PASSWORD) && password === STAFF_PASSWORD;
}

export function requireStaffConfigured() {
  if (!STAFF_PASSWORD) throw new Error("STAFF_PASSWORD 환경변수가 설정되지 않았습니다.");
}

export async function isStaffAuthenticated() {
  const store = cookies();
  const token = store.get(STAFF_COOKIE_NAME)?.value;
  return validateStaffToken(token);
}

export function getStaffCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  };
}

export { STAFF_COOKIE_NAME };
