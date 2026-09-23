-- 페이지(덱)별 방문 기록 — user-activity-setup.sql 실행 이후에 한 번 실행하세요.
-- 수강생×페이지당 1행. admin.html "진도" 탭의 덱별 도달 인원·수강생별 최종 도달에 쓰입니다.

create table if not exists public.page_visits (
  user_id       uuid not null references auth.users (id) on delete cascade,
  path          text not null,
  title         text,
  views         int not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  primary key (user_id, path)
);

alter table public.page_visits enable row level security;

-- 조회는 관리자만 (기록은 아래 security definer 함수가 담당)
drop policy if exists "pv_admin_select" on public.page_visits;
create policy "pv_admin_select" on public.page_visits
  for select using ((auth.jwt() ->> 'email') = 'xxjjvxb@gmail.com');

-- 기존 touch_activity 교체 — user_activity 갱신에 더해 page_visits도 함께 기록
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

  insert into public.page_visits as pv (user_id, path, title)
  values (auth.uid(), left(p_path, 300), left(p_title, 300))
  on conflict (user_id, path) do update set
    views        = pv.views + 1,
    title        = excluded.title,
    last_seen_at = now();
end;
$$;

revoke all on function public.touch_activity(text, text) from public;
grant execute on function public.touch_activity(text, text) to authenticated;
