import { NextResponse } from "next/server";
import { isStaffAuthenticated } from "../../../../lib/staff-auth";
import { isSupabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";

export async function GET() {
  if (!(await isStaffAuthenticated())) return NextResponse.json({ ok: false, message: '직원 인증이 필요합니다.' }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: 'Supabase 환경변수가 설정되지 않았습니다.' }, { status: 500 });
  try {
    const [inquiries, assignees] = await Promise.all([
      supabaseRest('/inquiries', { query: { select: 'id,name,phone,email,address,loan_type,memo,source_page,property_type,city,district,town,apartment,area,status,job_type,assignee,call_summary,internal_memo,created_at,updated_at', order: 'created_at.desc', limit: 300 } }),
      supabaseRest('/staff_members', { query: { select: 'id,name,status,note,created_at', order: 'created_at.desc', limit: 200 } }),
    ]);
    return NextResponse.json({ ok: true, inquiries: Array.isArray(inquiries) ? inquiries : [], assignees: Array.isArray(assignees) ? assignees : [] });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || '상담접수 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
