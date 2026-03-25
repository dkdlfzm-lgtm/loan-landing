# API / DB 설정 메모

## 1. 시세조회 관련
- `/api/reb-market` : 한국부동산원 Open API 기반 시세조회
- `/api/property-catalog` : `property-master.json` 또는 fallback 목록 반환
- `scripts/build-property-master.mjs` : 전국 단지 마스터 JSON 생성

## 2. DB 관련 (Supabase)
- `/api/inquiries` : 상담접수 저장
- `/api/reviews` : 이용후기 목록 / 작성
- `/api/reviews/[id]` : 이용후기 상세 / 조회수 증가
- `/api/reviews/[id]/comments` : 댓글 작성
- `/api/admin/*` : 관리자 로그인 / 상담접수 / 이용후기 관리

## 3. 필수 환경변수
```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
REB_OPENAPI_KEY=
DATA_GO_KR_KEY=
REB_APT_STATBL_ID=
REB_OFFICETEL_STATBL_ID=
REB_VILLA_STATBL_ID=
```

## 4. Supabase 초기화
Supabase SQL Editor에서 `supabase/schema.sql`을 먼저 실행한 뒤 사이트를 사용해야 합니다.
