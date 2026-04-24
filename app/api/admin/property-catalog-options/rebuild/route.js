import { NextResponse } from "next/server";
import { isAdminAccessAuthenticated } from "../../../../../lib/admin-auth";
import { isSupabaseConfigured, supabaseRest } from "../../../../../lib/supabase-rest";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  if (!(await isAdminAccessAuthenticated())) {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const rows = await supabaseRest("/property_catalog_options", {
      query: {
        select: "option_level",
        property_type: "eq.아파트",
        limit: "20000",
      },
    });

    const counts = { city: 0, district: 0, town: 0, apartment: 0, area: 0 };
    for (const row of Array.isArray(rows) ? rows : []) {
      if (row?.option_level in counts) counts[row.option_level] += 1;
    }

    return NextResponse.json({ ok: true, counts, total: Object.values(counts).reduce((a, b) => a + b, 0) });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error?.message || "빠른 옵션 테이블 상태를 확인하지 못했습니다." }, { status: 500 });
  }
}

export async function POST() {
  if (!(await isAdminAccessAuthenticated())) {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const data = await supabaseRest("/rpc/refresh_property_catalog_options", {
      method: "POST",
      body: {},
    });

    globalThis.__PROPERTY_CATALOG_FAST_CACHE__?.clear?.();

    return NextResponse.json({
      ok: true,
      message: "빠른 드롭다운 옵션 테이블 재생성이 완료되었습니다.",
      result: Array.isArray(data) ? data[0] : data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error?.message ||
          "빠른 옵션 테이블 재생성에 실패했습니다. Supabase SQL Editor에서 01_property_catalog_options.sql을 먼저 실행했는지 확인하세요.",
      },
      { status: 500 }
    );
  }
}
