import { NextResponse } from "next/server";
import { isAdminAccessAuthenticated } from "../../../../lib/admin-auth";
import { isSupabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";
import { hashStaffPassword, normalizeStaffRole } from "../../../../lib/staff-auth";

export async function GET() {
  if (!(await isAdminAccessAuthenticated())) return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });

  try {
    const accounts = await supabaseRest("/staff_accounts", {
      query: {
        select: "id,username,display_name,status,staff_member_id,role,created_at,updated_at",
        order: "created_at.desc",
        limit: 200,
      },
    });
    return NextResponse.json({ ok: true, accounts: Array.isArray(accounts) ? accounts : [] });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "직원 계정 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await isAdminAccessAuthenticated())) return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });

  try {
    const body = await request.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();
    const display_name = String(body.display_name || "").trim();
    const staff_member_id = body.staff_member_id ? String(body.staff_member_id).trim() : null;
    const role = normalizeStaffRole(body.role);

    if (!username || !password || !display_name) {
      return NextResponse.json({ ok: false, message: "아이디, 비밀번호, 표시 이름을 모두 입력해주세요." }, { status: 400 });
    }

    const inserted = await supabaseRest("/staff_accounts", {
      method: "POST",
      prefer: "return=representation",
      body: [{
        username,
        password_hash: hashStaffPassword(password),
        display_name,
        status: "active",
        staff_member_id,
        role,
      }],
    });

    return NextResponse.json({ ok: true, account: Array.isArray(inserted) ? inserted[0] : inserted });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "직원 계정을 생성하지 못했습니다." }, { status: 500 });
  }
}
