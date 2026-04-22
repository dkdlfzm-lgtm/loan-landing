export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

function jsonNoStore(body, init = {}) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
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
    const { master, source } = await loadPropertyMaster(request.url);
    const result = resolvePropertyOptions(master, query);
    const isEmptySource = source === "missing";

    return jsonNoStore({
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
      warning: isEmptySource ? "public/property-master.json 파일이 아직 없습니다. 생성한 전국 목록 파일을 public 폴더에 넣어주세요." : "",
    });
  } catch (error) {
    return jsonNoStore({ ok: false, message: error?.message || "단지 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
