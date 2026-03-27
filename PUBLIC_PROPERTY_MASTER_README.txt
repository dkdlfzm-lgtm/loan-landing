[적용 방법]
1) 지금 생성한 전국 목록 JSON 파일 이름을 property-master.json 으로 바꿉니다.
2) 이 프로젝트의 public/property-master.json 파일을 생성한 파일로 덮어씁니다.
3) GitHub 푸시 후 Vercel 재배포하면 바로 목록에 반영됩니다.

[운영 구조]
- 목록: public/property-master.json
- 시세 결과: 한국부동산원 API

[중요]
운영 중에는 DATA_GO_KR_KEY 가 없어도 됩니다.
목록을 다시 만들 때만 DATA_GO_KR_KEY 를 사용하면 됩니다.
