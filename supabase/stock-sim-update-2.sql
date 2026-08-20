-- 주식 시뮬 업데이트 2 (성능) — Supabase SQL Editor에 전체를 붙여넣어 한 번 실행하세요. 재실행해도 안전.
--
-- 증상: 동시 접속 5명 + 라이브 보드에서 모든 API가 5초 타임아웃. Vercel을 우회해 Supabase RPC를
--       직접 호출해도 멈춤 → DB(Postgres)가 포화되어 커넥션이 전부 물린 상태.
-- 원인: stock_history가 포인트마다 stock_impact_sum(최근 1시간 impacts 전체 스캔)과
--       stock_trades 상관 서브쿼리를 재실행 → 한 번 호출에 300~600 포인트.
--       보드가 초당 3회(seconds=900, 450포인트) 호출하므로 체결이 쌓일수록 비용이 제곱으로 증가.
-- 조치: ① 인덱스  ② 임팩트 윈도 1시간→10분  ③ history 포인트 150개 상한 + 집계 1회
--       ④ 리더보드·포트폴리오의 가격 계산 6회→3회

-- ---------- ① 인덱스 ----------
create index if not exists stock_trades_sym_t on public.stock_trades (symbol, t);

-- ---------- ② 임팩트 윈도 1시간 → 10분 ----------
-- 감쇠 시상수가 180초라 600초 지나면 잔여 기여가 3% 미만. 사실상 0인 구간을 매번 스캔하고 있었다.
create or replace function public.stock_impact_sum(p_symbol text, p_ts timestamptz)
returns double precision language sql stable as $$
  select coalesce(sum(
    i.side * least(i.qty * 0.0002, 0.02) * exp(-extract(epoch from (p_ts - i.t))::double precision / 180.0)
  ), 0)
  from public.stock_impacts i
  where i.symbol = p_symbol and i.t <= p_ts and i.t > p_ts - interval '600 seconds'
$$;

-- ---------- ③ history — 포인트 150개 상한 · 임팩트/체결량은 쿼리당 1회 집계 ----------
-- 반환 형태(t·price·volume)와 가격 공식은 그대로. 포인트별 재스캔만 제거했다.
create or replace function public.stock_history(p_symbol text, p_seconds int default 600)
returns table (t timestamptz, price numeric, volume int)
language sql stable security definer set search_path = public as $$
  with st as (
    select secs, t1,
           t1 - make_interval(secs => secs) as t0,
           greatest(1, ceil(secs / 150.0))::int as step      -- 창이 넓으면 간격을 늘려 포인트 수를 고정
    from (select least(greatest(coalesce(p_seconds, 600), 10), 3600) as secs, now() as t1) p
  ),
  pts as materialized (
    select i, st.t0 + make_interval(secs => (i * st.step)::double precision) as gt
    from st, lateral generate_series(0, (st.secs / st.step)::int) i
  ),
  imp as materialized (                                      -- 임팩트: 초 단위로 미리 합산
    select date_trunc('second', i.t) as ts,
           sum(i.side * least(i.qty * 0.0002, 0.02))::double precision as w
    from public.stock_impacts i, st
    where i.symbol = p_symbol
      and i.t >  st.t0 - interval '600 seconds'
      and i.t <= st.t1
    group by 1
  ),
  vol as materialized (                                      -- 참여자 체결량: 포인트 버킷으로 한 번에 집계
    select ceil(extract(epoch from (tr.t - st.t0)) / st.step)::int as i,
           sum(tr.qty)::int as q
    from public.stock_trades tr, st
    where tr.symbol = p_symbol and tr.t > st.t0 and tr.t <= st.t1
    group by 1
  )
  select pts.gt,
         round((public.stock_base_price(p_symbol, pts.gt) * (1 + coalesce((
             select sum(imp.w * exp(-extract(epoch from (pts.gt - imp.ts))::double precision / 180.0))
             from imp
             where imp.ts <= pts.gt and imp.ts > pts.gt - interval '600 seconds'
           ), 0)))::numeric, 2),
         (public.stock_base_volume(p_symbol, pts.gt) * (select step from st))
           + coalesce((select v.q from vol v where v.i = pts.i), 0)
  from pts
  where p_symbol in ('A','B','C')
    and (select c.enabled from public.stock_config c where c.id = 1)
  order by 1
$$;

-- ---------- ④ 리더보드 · 포트폴리오 — 가격은 쿼리당 3회만 ----------
-- 기존엔 참여자 1명당 stock_price_at을 6번 호출했다(평가액 3 + 수익률 3).
create or replace function public.stock_leaderboard()
returns table (name text, value numeric, pnl_pct numeric)
language sql stable security definer set search_path = public as $$
  with q as materialized (
    select public.stock_price_at('A', now()) as pa,
           public.stock_price_at('B', now()) as pb,
           public.stock_price_at('C', now()) as pc
  ), v as (
    select k.name as nm, (k.cash + k.pos_a * q.pa + k.pos_b * q.pb + k.pos_c * q.pc) as val
    from public.stock_keys k, q
    where (select c.enabled from public.stock_config c where c.id = 1)
  )
  select v.nm, round(v.val, 0), round((v.val - 1000000) / 10000.0, 2)
  from v
  order by v.val desc
  limit 50
$$;

create or replace function public.stock_portfolio(p_key uuid)
returns table (name text, cash numeric, pos_a int, pos_b int, pos_c int, value numeric, pnl_pct numeric, trades jsonb)
language sql stable security definer set search_path = public as $$
  with q as materialized (
    select public.stock_price_at('A', now()) as pa,
           public.stock_price_at('B', now()) as pb,
           public.stock_price_at('C', now()) as pc
  )
  select k.name, round(k.cash, 0), k.pos_a, k.pos_b, k.pos_c,
         round(k.cash + k.pos_a * q.pa + k.pos_b * q.pb + k.pos_c * q.pc, 0),
         round((k.cash + k.pos_a * q.pa + k.pos_b * q.pb + k.pos_c * q.pc - 1000000) / 10000.0, 2),
         coalesce((select jsonb_agg(jsonb_build_object('t', tr.t, 'symbol', tr.symbol, 'side', tr.side, 'qty', tr.qty, 'price', tr.price) order by tr.t desc)
                   from (select * from public.stock_trades where key = p_key order by t desc limit 20) tr), '[]'::jsonb)
  from public.stock_keys k, q
  where k.key = p_key
$$;

-- ---------- 통계 갱신 ----------
analyze public.stock_trades;
analyze public.stock_impacts;

-- ---------- 권한 (create or replace는 권한을 유지하지만 안전하게 재부여) ----------
grant execute on function public.stock_history(text, int) to anon, authenticated;
grant execute on function public.stock_leaderboard() to anon, authenticated;
grant execute on function public.stock_portfolio(uuid) to anon, authenticated;

-- ---------- 확인 ----------
-- 아래가 각각 수십 ms 안에 끝나면 정상.
--   explain analyze select * from public.stock_history('A', 900);
--   explain analyze select * from public.stock_leaderboard();
