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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inquiries add column if not exists email text;
alter table public.inquiries add column if not exists job_type text default '';
alter table public.inquiries add column if not exists assignee text default '미배정';
alter table public.inquiries add column if not exists call_summary text default '';
alter table public.inquiries add column if not exists internal_memo text default '';
alter table public.inquiries add column if not exists updated_at timestamptz not null default now();

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

create table if not exists public.inquiry_notes (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  author text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive')),
  note text default '',
  created_at timestamptz not null default now()
);


create table if not exists public.staff_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  display_name text not null,
  staff_member_id uuid references public.staff_members(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inquiries_created_at_idx on public.inquiries(created_at desc);
create index if not exists inquiries_status_idx on public.inquiries(status);
create index if not exists review_comments_review_id_idx on public.review_comments(review_id, created_at asc);
create index if not exists inquiry_notes_inquiry_id_idx on public.inquiry_notes(inquiry_id, created_at desc);
create index if not exists staff_members_status_idx on public.staff_members(status);
create index if not exists staff_accounts_status_idx on public.staff_accounts(status);
create index if not exists staff_accounts_staff_member_idx on public.staff_accounts(staff_member_id);

alter table public.inquiries disable row level security;
alter table public.reviews disable row level security;
alter table public.review_comments disable row level security;
alter table public.inquiry_notes disable row level security;
alter table public.staff_members disable row level security;
alter table public.staff_accounts disable row level security;

insert into public.staff_members (name, status, note)
values
  ('김희수', 'active', '상담팀'),
  ('박지훈', 'active', '상담팀'),
  ('이서연', 'active', '심사 지원')
on conflict (name) do nothing;


alter table public.inquiries add column if not exists assigned_staff_account_id uuid references public.staff_accounts(id) on delete set null;
create index if not exists inquiries_assigned_staff_account_idx on public.inquiries(assigned_staff_account_id);
