import { cookies } from "next/headers";
import crypto from "node:crypto";
import { isSupabaseConfigured, supabaseRest } from "./supabase-rest";

const STAFF_COOKIE_NAME = "loan_staff_session";
const STAFF_SESSION_SECRET = process.env.STAFF_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || "loan-staff-secret";

export const STAFF_ROLE_OPTIONS = [
  { value: "admin", label: "관리자" },
  { value: "marketing", label: "마케팅담당" },
  { value: "cs", label: "CS담당" },
  { value: "worker", label: "실무자" },
];

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function signToken(payload) {
  return crypto.createHmac("sha256", STAFF_SESSION_SECRET).update(payload).digest("hex");
}

function encodePayload(data) {
  return Buffer.from(JSON.stringify(data), "utf8").toString("base64url");
}

function decodePayload(payload) {
  try {
    return JSON.parse(Buffer.from(String(payload), "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function hashStaffPassword(password) {
  return sha256(password);
}

export function normalizeStaffRole(role) {
  const normalized = String(role || "").trim().toLowerCase();
  if (["admin", "marketing", "cs", "worker"].includes(normalized)) return normalized;
  return "worker";
}

export function getStaffRoleLabel(role) {
  return STAFF_ROLE_OPTIONS.find((item) => item.value === normalizeStaffRole(role))?.label || "실무자";
}

export function canManageSite(account) {
  const role = normalizeStaffRole(account?.role);
  return role === "admin" || role === "marketing";
}

export function canAccessStaffCRM(account) {
  const role = normalizeStaffRole(account?.role);
  return role === "admin" || role === "cs" || role === "worker";
}

export function createStaffToken(account) {
  const normalizedRole = normalizeStaffRole(account?.role);
  const payload = encodePayload({
    id: account?.id || "",
    username: account?.username || "",
    display_name: account?.display_name || account?.username || "",
    staff_member_id: account?.staff_member_id || null,
    role: normalizedRole,
  });
  return `${payload}.${signToken(payload)}`;
}

export function validateStaffToken(token) {
  if (!token) return null;
  const [payload, signature] = String(token).split(".");
  if (!payload || !signature) return null;
  if (signToken(payload) !== signature) return null;
  const decoded = decodePayload(payload);
  if (!decoded?.id || !decoded?.username) return null;
  return { ...decoded, role: normalizeStaffRole(decoded?.role) };
}

export function requireStaffConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  }
}

export async function findStaffAccountByCredentials(username, password) {
  requireStaffConfigured();

  const normalizedUsername = String(username || "").trim();
  const normalizedPassword = String(password || "");

  if (!normalizedUsername || !normalizedPassword) {
    return null;
  }

  const rows = await supabaseRest("/staff_accounts", {
    query: {
      select: "id,username,display_name,status,password_hash,staff_member_id,role",
      username: `eq.${normalizedUsername}`,
      limit: 1,
    },
  });

  const account = Array.isArray(rows) ? rows[0] : null;
  if (!account || account.status !== "active") return null;
  if (String(account.password_hash || "") !== hashStaffPassword(normalizedPassword)) return null;
  return { ...account, role: normalizeStaffRole(account?.role) };
}

export async function getStaffSession() {
  const store = cookies();
  const token = store.get(STAFF_COOKIE_NAME)?.value;
  return validateStaffToken(token);
}

export async function isStaffAuthenticated() {
  return Boolean(await getStaffSession());
}

export async function getStaffAccountById(accountId) {
  requireStaffConfigured();
  if (!accountId) return null;
  const rows = await supabaseRest("/staff_accounts", {
    query: {
      select: "id,username,display_name,status,staff_member_id,role",
      id: `eq.${accountId}`,
      limit: 1,
    },
  });
  const account = Array.isArray(rows) ? rows[0] : null;
  if (!account || account.status !== "active") return null;
  return { ...account, role: normalizeStaffRole(account?.role) };
}

export async function getAuthenticatedStaffAccount() {
  const session = await getStaffSession();
  if (!session?.id) return null;
  const account = await getStaffAccountById(session.id);
  return account ? { ...session, ...account, role: normalizeStaffRole(account?.role || session?.role) } : null;
}

export async function requireAuthenticatedStaffAccount() {
  const account = await getAuthenticatedStaffAccount();
  if (!account) {
    throw new Error("직원 인증이 필요합니다.");
  }
  return account;
}

export function getStaffCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export { STAFF_COOKIE_NAME };
