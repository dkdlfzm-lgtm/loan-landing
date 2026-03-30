alter table public.inquiries drop constraint if exists inquiries_status_check;

alter table public.inquiries
  add constraint inquiries_status_check
  check (status in ('new', 'absent', 'callback', 'hold', 'rejected', 'in_progress', 'preapproved', 'approved'));
