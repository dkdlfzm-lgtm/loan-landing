import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseRest } from "../../../lib/supabase-rest";

export async function POST(request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    const {
      name,
      phone,
      address,
      loanType,
      memo,
      sourcePage,
      propertyType,
      city,
      district,
      town,
      apartment,
      area,
    } = body || {};

    const cleanName = String(name || "").trim();
    const cleanPhone = String(phone || "").trim();

    if (!cleanName || !cleanPhone) {
      return NextResponse.json(
        { ok: false, message: "성함과 연락처를 입력해주세요." },
        { status: 400 }
      );
    }

    const inserted = await supabaseRest("/inquiries", {
      method: "POST",
      prefer: "return=representation",
      body: [
        {
          name: cleanName,
          phone: cleanPhone,
          address: String(address || "").trim(),
          loan_type: String(loanType || "").trim(),
          memo: String(memo || "").trim(),
          source_page: String(sourcePage || "home").trim(),
          property_type: String(propertyType || "").trim(),
          city: String(city || "").trim(),
          district: String(district || "").trim(),
          town: String(town || "").trim(),
          apartment: String(apartment || "").trim(),
          area: String(area || "").trim(),

          status: "신규접수",
          job_type: "",
          assignee: "미배정",
          assigned_staff_account_id: null,
          call_summary: "",
          internal_memo: "",
          updated_at: new Date().toISOString(),
        },
      ],
    });

    const row = Array.isArray(inserted) ? inserted[0] : inserted;

    return NextResponse.json({
      ok: true,
      message: "접수되었습니다.",
      inquiry: row,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error.message || "상담접수를 저장하지 못했습니다." },
      { status: 500 }
    );
  }
}
