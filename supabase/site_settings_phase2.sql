alter table public.site_settings
  add column if not exists logo_url text not null default '/andi-logo.jpg',
  add column if not exists hero_feature_1 text not null default '무료 한도 상담',
  add column if not exists hero_feature_2 text not null default '빠른 접수 확인',
  add column if not exists hero_feature_3 text not null default '맞춤 상담 연결',
  add column if not exists reviews_enabled boolean not null default true;

update public.site_settings
set logo_url = coalesce(nullif(logo_url, ''), '/andi-logo.jpg'),
    hero_feature_1 = coalesce(nullif(hero_feature_1, ''), '무료 한도 상담'),
    hero_feature_2 = coalesce(nullif(hero_feature_2, ''), '빠른 접수 확인'),
    hero_feature_3 = coalesce(nullif(hero_feature_3, ''), '맞춤 상담 연결')
where scope = 'main';

insert into public.site_settings (
  scope,
  logo_url,
  hero_feature_1,
  hero_feature_2,
  hero_feature_3,
  reviews_enabled
)
values (
  'main',
  '/andi-logo.jpg',
  '무료 한도 상담',
  '빠른 접수 확인',
  '맞춤 상담 연결',
  true
)
on conflict (scope) do update
set logo_url = excluded.logo_url;
