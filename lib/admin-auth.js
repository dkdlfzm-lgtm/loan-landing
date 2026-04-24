import { cookies } from "next/headers";
import crypto from "node:crypto";
import {
  canAccessOwnerConsole,
  canManageSite,
  getAuthenticatedStaffAccount,
  getAllowedPages,
  getStaffRoleLabel,
} from "./staff-auth";

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

export async function getAdminAccessSession() {
  if (await isAdminAuthenticated()) {
    return {
      authenticated: true,
      type: "admin_password",
      label: "관리자",
      role: "admin",
      role_label: "관리자",
      allowed_pages: ["/admin", "/staff", "/manage", "/manage-mobile"],
    };
  }

  try {
    const account = await getAuthenticatedStaffAccount();
    if (account && canAccessOwnerConsole(account)) {
      return {
        authenticated: true,
        type: "staff",
        account: { ...account, role_label: getStaffRoleLabel(account.role), allowed_pages: getAllowedPages(account) },
        label: account.display_name || account.username || "직원",
        role: account.role,
        role_label: getStaffRoleLabel(account.role),
        allowed_pages: getAllowedPages(account),
      };
    }
  } catch {
    // Supabase 미설정 또는 세션 조회 실패 시 일반 관리자 쿠키 인증만 사용합니다.
  }

  return { authenticated: false };
}

export async function isAdminAccessAuthenticated() {
  return Boolean((await getAdminAccessSession())?.authenticated);
}

export async function getSiteManageAccessSession() {
  if (await isAdminAuthenticated()) {
    return {
      authenticated: true,
      type: "admin_password",
      label: "관리자",
      role: "admin",
      role_label: "관리자",
      allowed_pages: ["/admin", "/staff", "/manage", "/manage-mobile"],
    };
  }

  try {
    const account = await getAuthenticatedStaffAccount();
    if (account && canManageSite(account)) {
      return {
        authenticated: true,
        type: "staff",
        account: { ...account, role_label: getStaffRoleLabel(account.role), allowed_pages: getAllowedPages(account) },
        label: account.display_name || account.username || "직원",
        role: account.role,
        role_label: getStaffRoleLabel(account.role),
        allowed_pages: getAllowedPages(account),
      };
    }
  } catch {
    // Supabase 미설정 또는 세션 조회 실패 시 일반 관리자 쿠키 인증만 사용합니다.
  }

  return { authenticated: false };
}

export async function isSiteManageAuthenticated() {
  return Boolean((await getSiteManageAccessSession())?.authenticated);
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
