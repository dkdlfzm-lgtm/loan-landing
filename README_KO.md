# 대출 랜딩 프로젝트 (DB 게시판 + 관리자 포함)

이 버전은 이용후기와 상담접수를 **Supabase DB에 실제 저장**하고, 관리자 페이지에서 함께 확인할 수 있게 정리한 패키지입니다.

## 이번 버전에 포함된 것
- 홈 화면 이용후기 영역 → DB에서 최신 3건 불러오기
- `/reviews` 이용후기 목록
- `/reviews/write` 이용후기 작성
- `/reviews/[id]` 상세 + 댓글 작성
- 홈/결과 화면 상담접수 → DB 저장
- `/admin` 관리자 로그인 + 상담접수/이용후기 상태 관리
- Supabase SQL 스키마: `supabase/schema.sql`

## 먼저 해야 할 것
1. Supabase 프로젝트 생성
2. Supabase SQL Editor에서 `supabase/schema.sql` 실행
3. 프로젝트 루트에 `.env.local` 생성 후 `.env.example` 값을 참고해서 입력
4. `npm install`
5. `npm run dev`

## 꼭 넣어야 하는 환경변수
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_PASSWORD=원하는관리자비밀번호
ADMIN_SESSION_SECRET=임의의긴문자열
```

기존 시세조회용 키도 그대로 함께 사용합니다.
```env
REB_OPENAPI_KEY=...
DATA_GO_KR_KEY=...
REB_APT_STATBL_ID=A_2024_00045
REB_OFFICETEL_STATBL_ID=A_2024_00615
REB_VILLA_STATBL_ID=A_2024_00189
```

## Supabase에서 어디서 값을 찾는지
- `SUPABASE_URL`: Project Settings → Data API → Project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Project Settings → Data API → service_role key

`service_role` 키는 서버 전용이며 브라우저에 노출하면 안 됩니다. Supabase 공식 문서도 service_role 키는 서버에서만 사용하라고 안내합니다.

## 관리자 페이지
- 주소: `/admin`
- 비밀번호: `.env.local`의 `ADMIN_PASSWORD`
- 기능:
  - 상담접수 목록 확인
  - 상담접수 상태 변경 (신규 / 연락완료 / 처리완료)
  - 이용후기 상태 변경 (게시중 / 숨김)

## 전국 단지 마스터 생성
기존처럼 아래 명령으로 생성할 수 있습니다.
```bash
npm run build:property-master
```

생성 후 아래 주소에서 `source: "property-master.json"` 이 보이면 정상입니다.
```text
http://localhost:3000/api/property-catalog
```

## 배포 전 필수
Vercel 환경변수에도 아래를 모두 추가해야 합니다.
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `REB_OPENAPI_KEY`
- `DATA_GO_KR_KEY`
- `REB_APT_STATBL_ID`
- `REB_OFFICETEL_STATBL_ID`
- `REB_VILLA_STATBL_ID`

## 참고
- Supabase는 Next.js용 빠른 시작 가이드와 서버 전용 키 사용 방식을 공식 문서로 제공하고 있습니다.
