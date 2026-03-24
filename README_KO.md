# 대출 랜딩 프로젝트 정리본

이 압축본은 깃허브에 바로 올리기 쉽게 정리한 버전입니다.

## 포함된 것
- 배포 가능한 Next.js 프로젝트 파일
- 첫 화면 UI 수정본
- `/api/reb-market` 시세조회 API 라우트
- `/api/property-catalog` 목록 API 라우트
- 외부 전국 단지 마스터를 붙일 수 있는 구조
- 전국 단지 마스터 생성용 스크립트 예시: `scripts/build-property-master.mjs`
- 샘플 마스터 JSON: `public/property-master.sample.json`

## 포함하지 않은 것
- `node_modules`
- `.next`
- 실제 비밀키가 들어간 `.env.local`

## 1. 깃허브에 올릴 때
이 압축을 풀고, 안의 파일들만 프로젝트 루트에 덮어쓰면 됩니다.

올려야 하는 대표 파일:
- `app/`
- `public/`
- `scripts/`
- `package.json`
- `package-lock.json`
- `.env.example`
- `API_SETUP.md`
- `README_KO.md`

## 2. 로컬 실행
```bash
npm install
npm run dev
```

## 3. 배포 전 필수
프로젝트 루트에 `.env.local` 파일을 만들고 필요한 값을 넣어야 합니다.
기본 양식은 `.env.example` 참고.

## 4. 전국 단지 마스터를 붙이는 방법
### 방법 A: 외부 JSON 사용
외부에 `property-master.json`을 올리고 Vercel 환경변수에 아래를 추가:
```env
PROPERTY_MASTER_URL=https://.../property-master.json
```

### 방법 B: 직접 생성
공공데이터 키를 준비한 뒤:
```bash
npm run build:property-master
```
실행 후 `public/property-master.json` 생성.

## 5. 꼭 알아둘 점
- 현재 `scripts/build-property-master.mjs`는 **실행용 뼈대**입니다.
- 실제 공공데이터 서비스별 응답 필드명이 다를 수 있어서, 1회 필드명 점검이 필요합니다.
- 즉, 구조는 잡아뒀지만 공공데이터 응답에 맞는 최종 미세조정은 필요합니다.

## 6. 깃허브 반영
```bash
git add .
git commit -m "Apply organized project files"
git push
```

## 7. Vercel
- Root Directory: 비우기
- Framework Preset: Next.js
- Install Command: `npm install`
- Build Command: `npm run build`
