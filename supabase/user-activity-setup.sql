-- 수강생 접속 기록 — Supabase SQL Editor에서 한 번 실행하세요.
-- 슬라이드 페이지를 열 때마다 touch_activity RPC가 1행씩 갱신합니다 (수강생당 1행).
-- admin.html 열람 신청 탭에서 최종 접속·마지막 페이지·활동량으로 표시됩니다.

create table if not exists public.user_activity (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  email          text not null,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  last_path      text,
  last_title     text,
  page_views     int not null default 1,
  active_days    int not null default 1,
  last_seen_date date not null default ((now() at time zone 'Asia/Seoul'))::date
);

alter table public.user_activity enable row level security;

-- 조회는 관리자만 (기록은 아래 security definer 함수가 담당하므로 별도 정책 불필요)
drop policy if exists "ua_admin_select" on public.user_activity;
create policy "ua_admin_select" on public.user_activity
  for select using ((auth.jwt() ->> 'email') = 'xxjjvxb@gmail.com');

create or replace function public.touch_activity(p_path text, p_title text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if auth.uid() is null then
    return;
  end if;
  insert into public.user_activity as ua (user_id, email, last_path, last_title, last_seen_date)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', ''), left(p_path, 300), left(p_title, 300), v_today)
  on conflict (user_id) do update set
    last_seen_at   = now(),
    email          = excluded.email,
    last_path      = excluded.last_path,
    last_title     = excluded.last_title,
    page_views     = ua.page_views + 1,
    active_days    = ua.active_days + (case when ua.last_seen_date < v_today then 1 else 0 end),
    last_seen_date = v_today;
end;
$$;

revoke all on function public.touch_activity(text, text) from public;
grant execute on function public.touch_activity(text, text) to authenticated;
