const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";

const SUPABASE_SERVER_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

function ensureSupabaseEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVER_KEY) {
    throw new Error(
      "Supabase 환경변수가 설정되지 않았습니다. SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY 또는 SUPABASE_SERVICE_ROLE_KEY를 확인해주세요."
    );
  }
}

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVER_KEY);
}

function buildUrl(path, params) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${SUPABASE_URL}/rest/v1${normalized}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function supabaseRest(path, { method = "GET", query, body, headers = {}, prefer } = {}) {
  ensureSupabaseEnv();

  const response = await fetch(buildUrl(path, query), {
    method,
    headers: {
      apikey: SUPABASE_SERVER_KEY,
      Authorization: `Bearer ${SUPABASE_SERVER_KEY}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    const message = data?.message || data?.error_description || data?.error || "Supabase 요청에 실패했습니다.";
    throw new Error(message);
  }

  return data;
}
