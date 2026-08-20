-- 주식 시뮬 업데이트 1 (통합) — Supabase SQL Editor에 전체를 붙여넣어 한 번 실행하세요. 재실행해도 안전.
-- ① 시뮬 ON/OFF 스위치  ② 슬리피지 폐지 → 매수 수수료 0.02% (매도 무료)  ③ 시장 초기화 safeupdate 오류 수정

-- ---------- ① ON/OFF ----------
alter table public.stock_config add column if not exists enabled boolean not null default true;

create or replace function public.stock_sim_on()
returns boolean language sql stable security definer set search_path = public as $$
  select enabled from public.stock_config where id = 1
$$;

create or replace function public.stock_set_enabled(p_on boolean)
returns text language plpgsql volatile security definer set search_path = public as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'xxjjvxb@gmail.com' then
    raise exception 'admin only';
  end if;
  update public.stock_config set enabled = p_on where id = 1;
  return case when p_on then 'on' else 'off' end;
end
$$;

-- ---------- 조회 RPC — OFF면 빈 결과 (비용 ~0) ----------
create or replace function public.stock_quote()
returns table (symbol text, price numeric, volume int)
language sql stable security definer set search_path = public as $$
  select s.sym,
         public.stock_price_at(s.sym, now()),
         public.stock_base_volume(s.sym, now())
           + coalesce((select sum(tr.qty)::int from public.stock_trades tr
                       where tr.symbol = s.sym and tr.t > now() - interval '1 second'), 0)
  from (values ('A'), ('B'), ('C')) as s(sym)
  where (select c.enabled from public.stock_config c where c.id = 1)
$$;

create or replace function public.stock_history(p_symbol text, p_seconds int default 600)
returns table (t timestamptz, price numeric, volume int)
language sql stable security definer set search_path = public as $$
  with p as (
    select least(greatest(coalesce(p_seconds, 600), 10), 3600) as secs
  ), st as (
    select secs, greatest(1, ceil(secs / 600.0))::int as step from p
  )
  select gs as t,
         public.stock_price_at(p_symbol, gs),
         (public.stock_base_volume(p_symbol, gs) * st.step)
           + coalesce((select sum(tr.qty)::int from public.stock_trades tr
                       where tr.symbol = p_symbol and tr.t > gs - make_interval(secs => st.step) and tr.t <= gs), 0)
  from st, lateral generate_series(now() - make_interval(secs => st.secs), now(), make_interval(secs => st.step)) gs
  where p_symbol in ('A','B','C')
    and (select c.enabled from public.stock_config c where c.id = 1)
$$;

create or replace function public.stock_leaderboard()
returns table (name text, value numeric, pnl_pct numeric)
language sql stable security definer set search_path = public as $$
  select k.name,
         round(k.cash + k.pos_a * public.stock_price_at('A', now())
                      + k.pos_b * public.stock_price_at('B', now())
                      + k.pos_c * public.stock_price_at('C', now()), 0) as value,
         round((k.cash + k.pos_a * public.stock_price_at('A', now())
                       + k.pos_b * public.stock_price_at('B', now())
                       + k.pos_c * public.stock_price_at('C', now()) - 1000000) / 10000.0, 2) as pnl_pct
  from public.stock_keys k
  where (select c.enabled from public.stock_config c where c.id = 1)
  order by 2 desc
  limit 50
$$;

create or replace function public.stock_trades_feed(p_seconds int default 3600)
returns table (name text, symbol text, side text, qty int, price numeric, t timestamptz)
language sql stable security definer set search_path = public as $$
  select tr.name, tr.symbol, tr.side, tr.qty, tr.price, tr.t
  from public.stock_trades tr
  where tr.t > now() - make_interval(secs => least(greatest(coalesce(p_seconds, 3600), 10), 86400))
    and (select c.enabled from public.stock_config c where c.id = 1)
  order by tr.t desc
  limit 400
$$;

-- ---------- ② 주문 — 슬리피지 없음 · 수수료 0.02% ----------
-- 반환 형태가 바뀌므로(slippage_pct → fee) drop 후 재생성
drop function if exists public.stock_order(uuid, text, text, int);

create function public.stock_order(p_key uuid, p_symbol text, p_side text, p_qty int)
returns table (filled int, exec_price numeric, fee numeric, cash numeric, pos_a int, pos_b int, pos_c int)
language plpgsql volatile security definer set search_path = public as $$
declare
  k public.stock_keys%rowtype;
  exec numeric; v_fee numeric; total numeric; pos int;
begin
  if not (select enabled from public.stock_config where id = 1) then
    raise exception 'sim is off';
  end if;
  if p_symbol not in ('A','B','C') then raise exception 'invalid symbol (A/B/C)'; end if;
  if p_side not in ('buy','sell') then raise exception 'invalid side (buy/sell)'; end if;
  if p_qty is null or p_qty < 1 or p_qty > 10000 then raise exception 'qty must be 1..10000'; end if;

  select * into k from public.stock_keys where key = p_key for update;
  if not found then raise exception 'invalid api key'; end if;

  if exists (select 1 from public.stock_trades where key = p_key and t > now() - interval '1 second') then
    raise exception 'rate limit: 1 order per second';
  end if;

  exec  := public.stock_price_at(p_symbol, now());
  v_fee := case when p_side = 'buy' then round(exec * p_qty * 0.0002, 2) else 0 end;   -- 수수료: 매수만 0.02%
  total := exec * p_qty;

  pos := case p_symbol when 'A' then k.pos_a when 'B' then k.pos_b else k.pos_c end;

  if p_side = 'buy' then
    if k.cash < total + v_fee then raise exception 'not enough cash (need %, have %)', round(total + v_fee), round(k.cash); end if;
    k.cash := k.cash - total - v_fee; pos := pos + p_qty;
  else
    if pos < p_qty then raise exception 'not enough position (have %)', pos; end if;
    k.cash := k.cash + total; pos := pos - p_qty;
  end if;

  update public.stock_keys set
    cash  = k.cash,
    pos_a = case when p_symbol = 'A' then pos else stock_keys.pos_a end,
    pos_b = case when p_symbol = 'B' then pos else stock_keys.pos_b end,
    pos_c = case when p_symbol = 'C' then pos else stock_keys.pos_c end
  where key = p_key;

  insert into public.stock_trades (key, name, symbol, side, qty, price) values (p_key, k.name, p_symbol, p_side, p_qty, exec);
  insert into public.stock_impacts (symbol, side, qty) values (p_symbol, case when p_side = 'buy' then 1 else -1 end, p_qty);

  return query select p_qty, exec, v_fee,
    round(k.cash, 0),
    case when p_symbol = 'A' then pos else k.pos_a end,
    case when p_symbol = 'B' then pos else k.pos_b end,
    case when p_symbol = 'C' then pos else k.pos_c end;
end
$$;

-- ---------- ③ 시장 초기화 — safeupdate(WHERE 필수) 대응 ----------
create or replace function public.stock_reset()
returns text
language plpgsql volatile security definer set search_path = public as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'xxjjvxb@gmail.com' then
    raise exception 'admin only';
  end if;
  delete from public.stock_trades where true;
  delete from public.stock_impacts where true;
  update public.stock_keys set cash = 1000000, pos_a = 0, pos_b = 0, pos_c = 0 where true;
  update public.stock_config set seed = md5(random()::text), epoch = now() where id = 1;
  return 'reset ok';
end
$$;

-- ---------- 권한 ----------
revoke all on function public.stock_sim_on() from public;
revoke all on function public.stock_set_enabled(boolean) from public;
revoke all on function public.stock_order(uuid, text, text, int) from public;
grant execute on function public.stock_sim_on() to anon, authenticated;
grant execute on function public.stock_set_enabled(boolean) to authenticated;
grant execute on function public.stock_order(uuid, text, text, int) to anon, authenticated;
