create extension if not exists pgcrypto;

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  address text,
  loan_type text,
  memo text,
  source_page text default 'home',
  property_type text,
  city text,
  district text,
  town text,
  apartment text,
  area text,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  password_hash text not null,
  title text not null,
  content text not null,
  status text not null default 'published' check (status in ('published', 'hidden')),
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  name text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists inquiries_created_at_idx on public.inquiries(created_at desc);
create index if not exists inquiries_status_idx on public.inquiries(status);
create index if not exists reviews_created_at_idx on public.reviews(created_at desc);
create index if not exists reviews_status_idx on public.reviews(status);
create index if not exists review_comments_review_id_idx on public.review_comments(review_id, created_at asc);

alter table public.inquiries disable row level security;
alter table public.reviews disable row level security;
alter table public.review_comments disable row level security;

insert into public.reviews (name, email, password_hash, title, content, status, view_count)
values
  ('김민수', 'review1@example.com', encode(digest('1234', 'sha256'), 'hex'), '상담이 빨라서 좋았어요', '처음 문의했을 때부터 응답이 빨랐고 필요한 서류 안내도 깔끔해서 진행이 편했습니다. 대출 한도 설명도 이해하기 쉽게 도와주셔서 만족합니다.', 'published', 18),
  ('이서연', 'review2@example.com', encode(digest('1234', 'sha256'), 'hex'), '시세조회 후 상담 연결이 편했습니다', '원하는 단지를 먼저 조회해 보고 바로 상담을 신청할 수 있어서 좋았습니다. 진행 과정도 친절하게 설명해 주셔서 안심하고 문의할 수 있었어요.', 'published', 12),
  ('박지훈', 'review3@example.com', encode(digest('1234', 'sha256'), 'hex'), '복잡할 줄 알았는데 생각보다 쉬웠어요', '처음에는 어렵게 느껴졌는데 상담 과정이 체계적이라 빠르게 이해할 수 있었습니다. 필요한 조건도 비교해서 알려주셔서 도움이 많이 됐습니다.', 'published', 9)
on conflict do nothing;
