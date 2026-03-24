import { NextResponse } from "next/server";
import { loadPropertyMaster, resolvePropertyOptions } from "../../lib-property-master";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = {
    propertyType: searchParams.get("propertyType") || "아파트",
    city: searchParams.get("city") || "",
    district: searchParams.get("district") || "",
    town: searchParams.get("town") || "",
    apartment: searchParams.get("apartment") || "",
    apartmentQuery: searchParams.get("apartmentQuery") || "",
    area: searchParams.get("area") || "",
  };

  try {
    const { master, source } = await loadPropertyMaster();
    const result = resolvePropertyOptions(master, query);
    return NextResponse.json({
      ok: true,
      source,
      query: {
        city: result.city,
        district: result.district,
        town: result.town,
        apartment: result.apartment,
        area: result.area,
      },
      options: {
        cities: result.cities,
        districts: result.districts,
        towns: result.towns,
        apartments: result.apartments,
        areas: result.areas,
      },
      counts: result.counts,
      note:
        source === "fallback" || source === "fallback-cache"
          ? "현재는 내장 샘플 목록입니다. PROPERTY_MASTER_URL을 연결하면 전국 단지 마스터 기준으로 바뀝니다."
          : "외부 단지 마스터 기준으로 동작 중입니다.",
    });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error?.message || "단지 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
