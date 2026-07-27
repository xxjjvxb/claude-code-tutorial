-- 공개 문의(contact) 저장 테이블 — 로그인 없이 접수
-- Supabase SQL Editor에서 1회 실행.
-- 쓰기: 누구나(anon) 삽입만 가능 / 읽기: 관리자만.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text,
  email text not null,
  message text not null
);

alter table public.contact_messages enable row level security;

drop policy if exists "anon can insert contact" on public.contact_messages;
create policy "anon can insert contact" on public.contact_messages
  for insert to anon, authenticated
  with check (true);

drop policy if exists "admin can read contact" on public.contact_messages;
create policy "admin can read contact" on public.contact_messages
  for select to authenticated
  using (auth.jwt()->>'email' = 'xxjjvxb@gmail.com');
