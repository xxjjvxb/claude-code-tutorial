-- 질문·신고 위젯 — Supabase SQL Editor에 붙여넣어 실행하세요.
-- (access-setup.sql 실행 이후에 실행. 관리자 이메일이 다르면 아래 두 정책의 이메일 수정)

create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  email      text not null,
  type       text not null check (type in ('question', 'report')),
  deck_path  text not null,
  slide_no   int,
  page_title text,
  content    text not null,
  status     text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.feedback enable row level security;

-- 본인: 작성 + 본인 것 조회
create policy "fb_own_insert" on public.feedback
  for insert with check (auth.uid() = user_id);

create policy "fb_own_select" on public.feedback
  for select using (auth.uid() = user_id);

-- 관리자: 전체 조회 + 처리 상태 변경
create policy "fb_admin_select" on public.feedback
  for select using ((auth.jwt() ->> 'email') = 'xxjjvxb@gmail.com');

create policy "fb_admin_update" on public.feedback
  for update using ((auth.jwt() ->> 'email') = 'xxjjvxb@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'xxjjvxb@gmail.com');
