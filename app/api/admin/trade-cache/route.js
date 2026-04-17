export async function POST(request) {
  try {
    const serviceKey = process.env.DATA_GO_KR_KEY;
    if (!serviceKey) {
      return NextResponse.json(
        { ok: false, message: "DATA_GO_KR_KEY 환경변수가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const city = normalizeText(body?.city || "서울특별시");
    const district = normalizeText(body?.district || "");
    const town = normalizeText(body?.town || "");
    const fullIngest = Boolean(body?.fullIngest);
    const offset = Math.max(Number(body?.offset || 0), 0);
    const limit = Math.max(Number(body?.limit || 1), 1);

    const { master } = await loadPropertyMasterLocal();

    let targets = [];
    if (fullIngest) {
      const rows = master?.["아파트"]?.[city] || [];
      targets = dedupeTargets(rows.map((row) => ({ ...row, city })));
    } else {
      targets = dedupeTargets(
        collectTargets(master, city, district, town).map((row) => ({ ...row, city }))
      );
    }

    if (!targets.length) {
      return NextResponse.json(
        { ok: false, message: "적재할 단지 대상을 찾지 못했습니다." },
        { status: 400 }
      );
    }

    const chunkTargets = targets.slice(offset, offset + limit);

    let savedRows = 0;
    let processedTargets = 0;
    const errors = [];

    for (const target of chunkTargets) {
      try {
        const tradeRows = await fetchTradesForTarget(serviceKey, target);
        const result = await upsertTradeRows(tradeRows);
        savedRows += result.inserted;
        processedTargets += 1;
      } catch (err) {
        const errorMessage =
          typeof err === "string"
            ? err
            : err?.message
            ? err.message
            : err?.details
            ? err.details
            : JSON.stringify(err);

        const errorItem = {
          apartment: target.apartment_name,
          district: target.district,
          town: target.town,
          lawd_code: target.lawd_code,
          message: errorMessage || "unknown error",
        };

        errors.push(errorItem);

        console.error("[trade-cache ingest error]", errorItem);
      }
    }

    const nextOffset = offset + chunkTargets.length;
    const done = nextOffset >= targets.length;
    const currentTarget = chunkTargets[chunkTargets.length - 1] || null;
    const currentLabel = currentTarget
      ? [currentTarget.city, currentTarget.district, currentTarget.town, currentTarget.apartment_name]
          .filter(Boolean)
          .join(" ")
      : "";

    return NextResponse.json({
      ok: true,
      message: done ? "실거래 캐시 전체 적재가 완료되었습니다." : "다음 청크 적재가 완료되었습니다.",
      processedTargets,
      totalTargets: targets.length,
      savedRows,
      errorCount: errors.length,
      lastError: errors.length ? errors[errors.length - 1] : null,
      errors: errors.slice(0, 20),
      offset,
      nextOffset,
      limit,
      done,
      currentLabel,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || "실거래 캐시 적재에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}
