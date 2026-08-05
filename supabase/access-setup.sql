-- 강의자료 열람 게이트 — Supabase SQL Editor에 붙여넣어 실행하세요.
-- 관리자: xxjjvxb@gmail.com — 다르면 아래 두 정책의 이메일을 수정한 뒤 실행합니다.

create table if not exists public.access_requests (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  name         text,
  referral     text,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  decided_at   timestamptz
);

alter table public.access_requests enable row level security;

-- 본인: 신청(1회) + 본인 상태 조회
create policy "own_insert" on public.access_requests
  for insert with check (auth.uid() = user_id);

create policy "own_select" on public.access_requests
  for select using (auth.uid() = user_id);

-- 관리자: 전체 조회 + 승인/거절
create policy "admin_select" on public.access_requests
  for select using ((auth.jwt() ->> 'email') = 'xxjjvxb@gmail.com');

create policy "admin_update" on public.access_requests
  for update using ((auth.jwt() ->> 'email') = 'xxjjvxb@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'xxjjvxb@gmail.com');
