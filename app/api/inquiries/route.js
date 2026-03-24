import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseRest } from "../../../lib/supabase-rest";

export async function POST(request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { name, phone, email, address, loanType, memo, sourcePage, propertyType, city, district, town, apartment, area, jobType } = body || {};

    if (!String(name || "").trim() || !String(phone || "").trim()) {
      return NextResponse.json({ ok: false, message: "성함과 연락처를 입력해주세요." }, { status: 400 });
    }

    const inserted = await supabaseRest("/inquiries", {
      method: "POST",
      prefer: "return=representation",
      body: [{
        name: String(name).trim(),
        phone: String(phone).trim(),
        address: String(address || "").trim(),
        email: String(email || "").trim(),
        loan_type: String(loanType || "").trim(),
        memo: String(memo || "").trim(),
        source_page: String(sourcePage || "home").trim(),
        property_type: String(propertyType || "").trim(),
        city: String(city || "").trim(),
        district: String(district || "").trim(),
        town: String(town || "").trim(),
        apartment: String(apartment || "").trim(),
        area: String(area || "").trim(),
        job_type: String(jobType || "").trim(),
        assignee: "미배정",
        call_summary: "",
        internal_memo: "",
      }],
    });

    const row = Array.isArray(inserted) ? inserted[0] : inserted;
    return NextResponse.json({ ok: true, inquiry: row });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "상담접수를 저장하지 못했습니다." }, { status: 500 });
  }
}
