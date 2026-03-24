import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const DATA_GO_KR_KEY = process.env.DATA_GO_KR_KEY || "";

const fallbackCatalog = {
  아파트: {
    서울시: [
      {
        district: "강남구",
        town: "역삼동",
        apartment: "개나리래미안",
        areas: ["59.96㎡", "84.93㎡"],
      },
    ],
  },
  오피스텔: {},
  "빌라(연립/다세대)": {},
};

async function readLocalMaster() {
  try {
    const filePath = path.join(process.cwd(), "public", "property-master.json");
    const text = await fs.readFile(filePath, "utf-8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const localMaster = await readLocalMaster();

    if (localMaster) {
      return NextResponse.json({
        ok: true,
        source: "property-master.json",
        hasDataGoKrKey: Boolean(DATA_GO_KR_KEY),
        catalog: localMaster,
      });
    }

    return NextResponse.json({
      ok: true,
      source: "fallback",
      hasDataGoKrKey: Boolean(DATA_GO_KR_KEY),
      catalog: fallbackCatalog,
      message:
        "property-master.json 파일이 없어 fallback 데이터를 반환했습니다. DATA_GO_KR_KEY는 설정되어 있어도 아직 목록 생성 스크립트를 실행해야 전국 단위 목록이 반영됩니다.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "목록 조회 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
