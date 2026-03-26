import { NextResponse } from "next/server";
import { requireAuthenticatedStaffAccount } from "../../../../../lib/staff-auth";
import { isSupabaseConfigured, supabaseRest } from "../../../../../lib/supabase-rest";

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

export async function PATCH(request, { params }) {
  try {
    const account = await requireAuthenticatedStaffAccount();
    if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: 'Supabase 환경변수가 설정되지 않았습니다.' }, { status: 500 });

    const owned = await getOwnedInquiry(account.id, params.id);
    if (!owned) return NextResponse.json({ ok: false, message: '배정된 고객만 수정할 수 있습니다.' }, { status: 403 });

    const body = await request.json();
    const payload = {
      status: String(body.status || 'new').trim(),
      job_type: String(body.job_type || '').trim(),
      call_summary: String(body.call_summary || '').trim(),
      internal_memo: String(body.internal_memo || '').trim(),
      email: String(body.email || '').trim(),
      updated_at: new Date().toISOString(),
    };
    const updated = await supabaseRest(`/inquiries?id=eq.${params.id}`, { method: 'PATCH', prefer: 'return=representation', body: payload });
    return NextResponse.json({ ok: true, inquiry: Array.isArray(updated) ? updated[0] : null });
  } catch (error) {
    const status = error.message === '직원 인증이 필요합니다.' ? 401 : 500;
    return NextResponse.json({ ok: false, message: error.message || '상담 정보를 수정하지 못했습니다.' }, { status });
  }
}
