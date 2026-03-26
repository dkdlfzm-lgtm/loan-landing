import { NextResponse } from "next/server";
import { requireAuthenticatedStaffAccount } from "../../../../lib/staff-auth";
import { isSupabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";

export async function GET() {
  try {
    const account = await requireAuthenticatedStaffAccount();
    if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: 'Supabase 환경변수가 설정되지 않았습니다.' }, { status: 500 });

    const inquiries = await supabaseRest('/inquiries', {
      query: {
        select: 'id,name,phone,email,address,loan_type,memo,source_page,property_type,city,district,town,apartment,area,status,job_type,assignee,assigned_staff_account_id,call_summary,internal_memo,created_at,updated_at',
        assigned_staff_account_id: `eq.${account.id}`,
        order: 'created_at.desc',
        limit: 300,
      },
    });

    return NextResponse.json({ ok: true, inquiries: Array.isArray(inquiries) ? inquiries : [], account });
  } catch (error) {
    const status = error.message === '직원 인증이 필요합니다.' ? 401 : 500;
    return NextResponse.json({ ok: false, message: error.message || '상담접수 목록을 불러오지 못했습니다.' }, { status });
  }
}
