# Loan Landing

## DB 방식 아파트 검색 적용 순서
1. Supabase SQL Editor에서 `supabase/schema.sql` 실행
2. `.env.local`에 Supabase URL / Secret Key 입력
3. `npm run build:property-master`
4. `npm run sync:property-master`
5. `npm run dev` 후 시세조회 확인

## 핵심 포인트
- 시세조회 드롭다운은 `property_master` 테이블을 우선 사용합니다.
- DB에 데이터가 없으면 내장 샘플 목록으로 fallback 됩니다.
- 아파트명은 검색형 자동완성으로 동작합니다.
