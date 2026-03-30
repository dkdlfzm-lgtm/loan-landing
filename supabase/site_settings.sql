create table if not exists public.site_settings (
  scope text primary key,
  company_name text not null default '엔드아이에셋대부',
  company_subtitle text not null default '주택담보대출 · 대환대출 · 전세퇴거자금 상담',
  phone text not null default '070-8018-7437',
  kakao_id text not null default 'ANDi7437',
  kakao_url text not null default 'https://open.kakao.com/o/sbaltXmi',
  hero_badge text not null default '선택형 시세조회 · 빠른 상담 연결',
  hero_title text not null default E'아파트 시세조회부터
대출 상담 신청까지
한 번에 연결되는 구조',
  hero_description text not null default '필요한 주소 정보와 단지를 차례대로 선택하면 예상 시세와 상담 연결 화면으로 자연스럽게 이어지도록 구성한 고객용 메인 페이지입니다.',
  hero_primary_cta text not null default '빠른 시세조회',
  hero_secondary_cta text not null default '무료 상담 신청',
  consult_button_text text not null default '상담 신청',
  updated_at timestamptz not null default now()
);

insert into public.site_settings (scope)
values ('main')
on conflict (scope) do nothing;
