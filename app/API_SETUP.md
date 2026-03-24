# 한국부동산원 API 연결 방법

1. 프로젝트 루트에 `.env.local` 파일 생성
2. 아래 항목 입력

```env
REB_OPENAPI_KEY=발급받은인증키
REB_APT_STATBL_ID=아파트용통계표ID
REB_OFFICETEL_STATBL_ID=오피스텔용통계표ID
REB_VILLA_STATBL_ID=빌라용통계표ID
```

## 현재 적용된 내용
- 조회 버튼 클릭 시 `/api/reb-market` 호출
- Next 서버에서 한국부동산원 R-ONE Open API 호출
- 결과 페이지에 최신 가격 / 범위 / 예상 가능 한도 / 최근 추이 표시
- 인증키 또는 통계표 ID가 없으면 예시 데이터로 fallback

## 참고
- API 기본 주소: `https://www.reb.or.kr/r-one/openapi/`
- 인증키 없이 호출하면 sample 처리
