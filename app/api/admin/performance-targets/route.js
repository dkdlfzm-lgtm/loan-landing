import { NextResponse } from "next/server";
import { isAdminAccessAuthenticated } from "../../../../lib/admin-auth";
import { isSupabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";

export async function GET() {
  if (!(await isAdminAccessAuthenticated())) return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  try {
    const targets = await supabaseRest('/performance_targets', {
      query: { select: 'staff_account_id,goal,memo,updated_at', order: 'updated_at.desc', limit: 300 },
    });
    return NextResponse.json({ ok: true, targets: Array.isArray(targets) ? targets : [] });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || '실적 목표를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await isAdminAccessAuthenticated())) return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  try {
    const body = await request.json();
    const staff_account_id = String(body?.staff_account_id || '').trim();
    const goal = Number(body?.goal || 0);
    const memo = String(body?.memo || '').trim();
    if (!staff_account_id) return NextResponse.json({ ok: false, message: '직원 계정 정보가 필요합니다.' }, { status: 400 });
    const result = await supabaseRest('/performance_targets', {
      method: 'POST',
      query: { on_conflict: 'staff_account_id', select: 'staff_account_id,goal,memo,updated_at' },
      prefer: 'resolution=merge-duplicates,return=representation',
      body: [{ staff_account_id, goal: Number.isFinite(goal) ? Math.max(0, Math.round(goal)) : 0, memo }],
    });
    const target = Array.isArray(result) ? result[0] : result;
    return NextResponse.json({ ok: true, target: target || { staff_account_id, goal, memo } });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || '실적 목표를 저장하지 못했습니다.' }, { status: 500 });
  }
}
