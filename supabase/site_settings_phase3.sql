alter table public.site_settings
  add column if not exists hero_background_url text not null default '',
  add column if not exists notice_enabled boolean not null default false,
  add column if not exists notice_text text not null default '금리와 한도는 조건에 따라 달라질 수 있으니 상담을 통해 정확하게 안내해드립니다.',
  add column if not exists popup_enabled boolean not null default false,
  add column if not exists popup_title text not null default '빠른 상담 안내',
  add column if not exists popup_description text not null default '대표번호 또는 카카오톡으로 문의를 남겨주시면 순차적으로 빠르게 상담을 도와드립니다.',
  add column if not exists popup_button_text text not null default '상담 바로가기',
  add column if not exists popup_button_url text not null default '#contact';

update public.site_settings
set hero_background_url = coalesce(hero_background_url, ''),
    notice_enabled = coalesce(notice_enabled, false),
    notice_text = coalesce(nullif(notice_text, ''), '금리와 한도는 조건에 따라 달라질 수 있으니 상담을 통해 정확하게 안내해드립니다.'),
    popup_enabled = coalesce(popup_enabled, false),
    popup_title = coalesce(nullif(popup_title, ''), '빠른 상담 안내'),
    popup_description = coalesce(nullif(popup_description, ''), '대표번호 또는 카카오톡으로 문의를 남겨주시면 순차적으로 빠르게 상담을 도와드립니다.'),
    popup_button_text = coalesce(nullif(popup_button_text, ''), '상담 바로가기'),
    popup_button_url = coalesce(nullif(popup_button_url, ''), '#contact')
where scope = 'main';

insert into public.site_settings (
  scope,
  hero_background_url,
  notice_enabled,
  notice_text,
  popup_enabled,
  popup_title,
  popup_description,
  popup_button_text,
  popup_button_url
)
values (
  'main',
  '',
  false,
  '금리와 한도는 조건에 따라 달라질 수 있으니 상담을 통해 정확하게 안내해드립니다.',
  false,
  '빠른 상담 안내',
  '대표번호 또는 카카오톡으로 문의를 남겨주시면 순차적으로 빠르게 상담을 도와드립니다.',
  '상담 바로가기',
  '#contact'
)
on conflict (scope) do nothing;
