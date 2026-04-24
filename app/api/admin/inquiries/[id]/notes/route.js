import { NextResponse } from "next/server";
import { isAdminAccessAuthenticated } from "../../../../../../lib/admin-auth";
import { isSupabaseConfigured, supabaseRest } from "../../../../../../lib/supabase-rest";

export async function GET(_request, { params }) {
  if (!(await isAdminAccessAuthenticated())) return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  try {
    const notes = await supabaseRest('/inquiry_notes', {
      query: { select: 'id,inquiry_id,author,content,created_at', inquiry_id: `eq.${params.id}`, order: 'created_at.desc', limit: 200 },
    });
    return NextResponse.json({ ok: true, notes: Array.isArray(notes) ? notes : [] });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || '상담 이력을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  if (!(await isAdminAccessAuthenticated())) return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  try {
    const body = await request.json();
    const author = String(body.author || '').trim();
    const content = String(body.content || '').trim();
    if (!author || !content) return NextResponse.json({ ok: false, message: '작성자와 내용을 입력해주세요.' }, { status: 400 });
    const inserted = await supabaseRest('/inquiry_notes', { method: 'POST', prefer: 'return=representation', body: [{ inquiry_id: params.id, author, content }] });
    await supabaseRest(`/inquiries?id=eq.${params.id}`, { method: 'PATCH', body: { call_summary: content.slice(0, 180), updated_at: new Date().toISOString() } });
    return NextResponse.json({ ok: true, note: Array.isArray(inserted) ? inserted[0] : inserted });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || '상담 이력을 저장하지 못했습니다.' }, { status: 500 });
  }
}
