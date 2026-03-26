import { NextResponse } from "next/server";
import { requireAuthenticatedStaffAccount } from "../../../../../../lib/staff-auth";
import { isSupabaseConfigured, supabaseRest } from "../../../../../../lib/supabase-rest";

async function getOwnedInquiry(accountId, inquiryId) {
  const rows = await supabaseRest('/inquiries', {
    query: {
      select: 'id,assigned_staff_account_id',
      id: `eq.${inquiryId}`,
      assigned_staff_account_id: `eq.${accountId}`,
      limit: 1,
    },
  });
  return Array.isArray(rows) ? rows[0] : null;
}

export async function GET(_request, { params }) {
  try {
    const account = await requireAuthenticatedStaffAccount();
    if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: 'Supabase 환경변수가 설정되지 않았습니다.' }, { status: 500 });

    const owned = await getOwnedInquiry(account.id, params.id);
    if (!owned) return NextResponse.json({ ok: false, message: '배정된 고객만 볼 수 있습니다.' }, { status: 403 });

    const notes = await supabaseRest('/inquiry_notes', { query: { select: 'id,inquiry_id,author,content,created_at', inquiry_id: `eq.${params.id}`, order: 'created_at.desc', limit: 200 } });
    return NextResponse.json({ ok: true, notes: Array.isArray(notes) ? notes : [] });
  } catch (error) {
    const status = error.message === '직원 인증이 필요합니다.' ? 401 : 500;
    return NextResponse.json({ ok: false, message: error.message || '상담 이력을 불러오지 못했습니다.' }, { status });
  }
}

export async function POST(request, { params }) {
  try {
    const account = await requireAuthenticatedStaffAccount();
    if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: 'Supabase 환경변수가 설정되지 않았습니다.' }, { status: 500 });

    const owned = await getOwnedInquiry(account.id, params.id);
    if (!owned) return NextResponse.json({ ok: false, message: '배정된 고객만 기록할 수 있습니다.' }, { status: 403 });

    const body = await request.json();
    const author = String(body.author || '').trim();
    const content = String(body.content || '').trim();
    if (!author || !content) return NextResponse.json({ ok: false, message: '작성자와 내용을 입력해주세요.' }, { status: 400 });
    const inserted = await supabaseRest('/inquiry_notes', { method: 'POST', prefer: 'return=representation', body: [{ inquiry_id: params.id, author, content }] });
    await supabaseRest(`/inquiries?id=eq.${params.id}`, { method: 'PATCH', body: { call_summary: content.slice(0, 180), updated_at: new Date().toISOString() } });
    return NextResponse.json({ ok: true, note: Array.isArray(inserted) ? inserted[0] : inserted });
  } catch (error) {
    const status = error.message === '직원 인증이 필요합니다.' ? 401 : 500;
    return NextResponse.json({ ok: false, message: error.message || '상담 이력을 저장하지 못했습니다.' }, { status });
  }
}
