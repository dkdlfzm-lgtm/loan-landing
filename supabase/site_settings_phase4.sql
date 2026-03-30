alter table public.site_settings
  add column if not exists middle_banner_enabled boolean default false,
  add column if not exists middle_banner_badge text default '맞춤 상담 안내',
  add column if not exists middle_banner_title text default '조건에 맞는 상담 연결을 빠르게 도와드립니다.',
  add column if not exists middle_banner_description text default '주택담보대출, 대환대출, 전세퇴거자금 등 원하는 상담 목적에 맞춰 접수 후 순차적으로 안내해드립니다.',
  add column if not exists middle_banner_button_text text default '상담 문의하기',
  add column if not exists middle_banner_button_url text default '#contact';
