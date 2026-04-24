import { NextResponse } from "next/server";
import { isAdminAccessAuthenticated } from "../../../../lib/admin-auth";
import { isSupabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";

export async function GET() {
  if (!(await isAdminAccessAuthenticated())) return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: 'Supabase 환경변수가 설정되지 않았습니다.' }, { status: 500 });
  try {
    const assignees = await supabaseRest('/staff_members', { query: { select: 'id,name,status,note,created_at', order: 'created_at.desc', limit: 200 } });
    return NextResponse.json({ ok: true, assignees: Array.isArray(assignees) ? assignees : [] });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || '담당자 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await isAdminAccessAuthenticated())) return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: 'Supabase 환경변수가 설정되지 않았습니다.' }, { status: 500 });
  try {
    const body = await request.json();
    const payload = { name: String(body.name || '').trim(), note: String(body.note || '').trim(), status: 'active' };
    if (!payload.name) return NextResponse.json({ ok: false, message: '담당자 이름을 입력해주세요.' }, { status: 400 });
    const inserted = await supabaseRest('/staff_members', { method: 'POST', prefer: 'return=representation', body: payload });
    return NextResponse.json({ ok: true, assignee: Array.isArray(inserted) ? inserted[0] : null });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || '담당자를 등록하지 못했습니다.' }, { status: 500 });
  }
}
