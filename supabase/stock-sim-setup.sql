-- 주식 시뮬 실습 (7장 데스크톱) — Supabase SQL Editor에 붙여넣어 실행하세요.
-- 설계: 가격은 "시드+timestamp 결정론 함수"로 즉석 계산(상주 프로세스 없음),
--       참여자 주문만 상태로 저장(임팩트·슬리피지), 모든 쓰기는 RPC로 원자 처리.
-- 종목 3개(A·B·C) · 시작 자금 1,000,000 · 수수료 없음 · 공매도 없음.

-- ---------- 테이블 ----------
create table if not exists public.stock_config (
  id    int primary key default 1 check (id = 1),
  seed  text not null default md5(random()::text),
  epoch timestamptz not null default now()
);
insert into public.stock_config (id) values (1) on conflict (id) do nothing;

create table if not exists public.stock_keys (
  key        uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  name       text not null,
  cash       numeric not null default 1000000,
  pos_a      int not null default 0,
  pos_b      int not null default 0,
  pos_c      int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_trades (
  id     bigserial primary key,
  key    uuid not null references public.stock_keys (key) on delete cascade,
  name   text not null,
  symbol text not null,
  side   text not null check (side in ('buy','sell')),
  qty    int not null,
  price  numeric not null,
  t      timestamptz not null default now()
);
create index if not exists stock_trades_t on public.stock_trades (t);

create table if not exists public.stock_impacts (
  id     bigserial primary key,
  symbol text not null,
  side   int not null,          -- buy=+1 · sell=-1
  qty    int not null,
  t      timestamptz not null default now()
);
create index if not exists stock_impacts_t on public.stock_impacts (symbol, t);

-- 직접 접근 차단 — 모든 조작은 아래 RPC로만
alter table public.stock_config  enable row level security;
alter table public.stock_keys    enable row level security;
alter table public.stock_trades  enable row level security;
alter table public.stock_impacts enable row level security;

-- ---------- 가격 엔진 ----------
-- 해시 → [0,1)
create or replace function public.stock_hash01(p_seed text, p_tag text, p_i bigint)
returns double precision language sql immutable as $$
  select (((hashtextextended(p_seed || '|' || p_tag || '|' || p_i::text, 0) % 1000000007) + 1000000007) % 1000000007)::double precision / 1000000007.0
$$;

-- 부드러운 value noise → [-1,1]
create or replace function public.stock_noise(p_seed text, p_tag text, p_x double precision)
returns double precision language sql immutable as $$
  select (
    (public.stock_hash01(p_seed, p_tag, floor(p_x)::bigint) * (1 - u) +
     public.stock_hash01(p_seed, p_tag, floor(p_x)::bigint + 1) * u) * 2 - 1
  ) from (select (p_x - floor(p_x)) * (p_x - floor(p_x)) * (3 - 2 * (p_x - floor(p_x))) as u) s
$$;

-- 기준가 (임팩트 제외) — 5배속 체감의 다층 랜덤워크
create or replace function public.stock_base_price(p_symbol text, p_ts timestamptz)
returns double precision language sql stable as $$
  select base * exp(
      0.055 * public.stock_noise(c.seed, p_symbol || ':240', e / 240.0)
    + 0.035 * public.stock_noise(c.seed, p_symbol || ':60',  e / 60.0)
    + 0.018 * public.stock_noise(c.seed, p_symbol || ':12',  e / 12.0)
    + 0.008 * public.stock_noise(c.seed, p_symbol || ':3',   e / 3.0)
  )
  from public.stock_config c,
       lateral (select extract(epoch from (p_ts - c.epoch))::double precision as e) t,
       lateral (select case p_symbol when 'A' then 10000.0 when 'B' then 25000.0 else 500.0 end as base) b
  where c.id = 1
$$;

-- 참여자 임팩트 합 (감쇠 · 1시간 롤링) — 주문 1건당 최대 ±2%, 3분 반감 수준
create or replace function public.stock_impact_sum(p_symbol text, p_ts timestamptz)
returns double precision language sql stable as $$
  select coalesce(sum(
    i.side * least(i.qty * 0.0002, 0.02) * exp(-extract(epoch from (p_ts - i.t))::double precision / 180.0)
  ), 0)
  from public.stock_impacts i
  where i.symbol = p_symbol and i.t <= p_ts and i.t > p_ts - interval '1 hour'
$$;

create or replace function public.stock_price_at(p_symbol text, p_ts timestamptz)
returns numeric language sql stable as $$
  select round((public.stock_base_price(p_symbol, p_ts) * (1 + public.stock_impact_sum(p_symbol, p_ts)))::numeric, 2)
$$;

-- 가상 거래량 (초당) — 참여자 체결량은 조회부에서 합산
create or replace function public.stock_base_volume(p_symbol text, p_ts timestamptz)
returns int language sql stable as $$
  select greatest(0, round(
      40 + 30 * public.stock_noise(c.seed, p_symbol || ':v7', e / 7.0)
         + 20 * public.stock_noise(c.seed, p_symbol || ':v1', e)
         + case when public.stock_hash01(c.seed, p_symbol || ':vb', floor(e / 5)::bigint) > 0.97 then 250 else 0 end
  ))::int
  from public.stock_config c,
       lateral (select extract(epoch from (p_ts - c.epoch))::double precision as e) t
  where c.id = 1
$$;

-- ---------- 조회 RPC ----------
create or replace function public.stock_quote()
returns table (symbol text, price numeric, volume int)
language sql stable security definer set search_path = public as $$
  select s.sym,
         public.stock_price_at(s.sym, now()),
         public.stock_base_volume(s.sym, now())
           + coalesce((select sum(tr.qty)::int from public.stock_trades tr
                       where tr.symbol = s.sym and tr.t > now() - interval '1 second'), 0)
  from (values ('A'), ('B'), ('C')) as s(sym)
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
  order by 2 desc
  limit 50
$$;

create or replace function public.stock_trades_feed(p_seconds int default 3600)
returns table (name text, symbol text, side text, qty int, price numeric, t timestamptz)
language sql stable security definer set search_path = public as $$
  select tr.name, tr.symbol, tr.side, tr.qty, tr.price, tr.t
  from public.stock_trades tr
  where tr.t > now() - make_interval(secs => least(greatest(coalesce(p_seconds, 3600), 10), 86400))
  order by tr.t desc
  limit 400
$$;

create or replace function public.stock_portfolio(p_key uuid)
returns table (name text, cash numeric, pos_a int, pos_b int, pos_c int, value numeric, pnl_pct numeric, trades jsonb)
language sql stable security definer set search_path = public as $$
  select k.name, round(k.cash, 0), k.pos_a, k.pos_b, k.pos_c,
         round(k.cash + k.pos_a * public.stock_price_at('A', now())
                      + k.pos_b * public.stock_price_at('B', now())
                      + k.pos_c * public.stock_price_at('C', now()), 0),
         round((k.cash + k.pos_a * public.stock_price_at('A', now())
                       + k.pos_b * public.stock_price_at('B', now())
                       + k.pos_c * public.stock_price_at('C', now()) - 1000000) / 10000.0, 2),
         coalesce((select jsonb_agg(jsonb_build_object('t', tr.t, 'symbol', tr.symbol, 'side', tr.side, 'qty', tr.qty, 'price', tr.price) order by tr.t desc)
                   from (select * from public.stock_trades where key = p_key order by t desc limit 20) tr), '[]'::jsonb)
  from public.stock_keys k
  where k.key = p_key
$$;

-- ---------- 주문 RPC (원자 처리) ----------
create or replace function public.stock_order(p_key uuid, p_symbol text, p_side text, p_qty int)
returns table (filled int, exec_price numeric, slippage_pct numeric, cash numeric, pos_a int, pos_b int, pos_c int)
language plpgsql volatile security definer set search_path = public as $$
declare
  k public.stock_keys%rowtype;
  mid numeric; slip numeric; exec numeric; total numeric; pos int;
begin
  if p_symbol not in ('A','B','C') then raise exception 'invalid symbol (A/B/C)'; end if;
  if p_side not in ('buy','sell') then raise exception 'invalid side (buy/sell)'; end if;
  if p_qty is null or p_qty < 1 or p_qty > 10000 then raise exception 'qty must be 1..10000'; end if;

  select * into k from public.stock_keys where key = p_key for update;
  if not found then raise exception 'invalid api key'; end if;

  -- rate limit: 주문은 키당 1초 1회
  if exists (select 1 from public.stock_trades where key = p_key and t > now() - interval '1 second') then
    raise exception 'rate limit: 1 order per second';
  end if;

  mid  := public.stock_price_at(p_symbol, now());
  slip := least(0.0005 * p_qty, 0.05);
  exec := round(mid * (1 + case when p_side = 'buy' then slip else -slip end), 2);
  total := exec * p_qty;

  pos := case p_symbol when 'A' then k.pos_a when 'B' then k.pos_b else k.pos_c end;

  if p_side = 'buy' then
    if k.cash < total then raise exception 'not enough cash (need %, have %)', round(total), round(k.cash); end if;
    k.cash := k.cash - total; pos := pos + p_qty;
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

  return query select p_qty, exec, round(slip * 100, 2),
    round(k.cash, 0),
    case when p_symbol = 'A' then pos else k.pos_a end,
    case when p_symbol = 'B' then pos else k.pos_b end,
    case when p_symbol = 'C' then pos else k.pos_c end;
end
$$;

-- ---------- 키 발급 (로그인 수강생 전용) ----------
create or replace function public.stock_issue_key()
returns table (key uuid, name text, cash numeric)
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  uemail text := coalesce(auth.jwt() ->> 'email', '');
  uname text;
  ok boolean;
begin
  if uid is null then raise exception 'login required'; end if;

  ok := lower(uemail) = 'xxjjvxb@gmail.com'
        or exists (select 1 from public.access_requests a where a.user_id = uid and a.status = 'approved');
  if not ok then raise exception 'not approved'; end if;

  select coalesce(a.name, split_part(uemail, '@', 1)) into uname
  from public.access_requests a where a.user_id = uid;
  if uname is null then uname := split_part(uemail, '@', 1); end if;

  return query
  insert into public.stock_keys (user_id, name) values (uid, uname)
  on conflict (user_id) do update set user_id = excluded.user_id
  returning stock_keys.key, stock_keys.name, round(stock_keys.cash, 0);
end
$$;

-- ---------- 라운드 리셋 (관리자 전용) ----------
create or replace function public.stock_reset()
returns text
language plpgsql volatile security definer set search_path = public as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'xxjjvxb@gmail.com' then
    raise exception 'admin only';
  end if;
  delete from public.stock_trades;
  delete from public.stock_impacts;
  update public.stock_keys set cash = 1000000, pos_a = 0, pos_b = 0, pos_c = 0;
  update public.stock_config set seed = md5(random()::text), epoch = now() where id = 1;
  return 'reset ok';
end
$$;

-- ---------- 권한 ----------
revoke all on function public.stock_quote() from public;
revoke all on function public.stock_history(text, int) from public;
revoke all on function public.stock_leaderboard() from public;
revoke all on function public.stock_trades_feed(int) from public;
revoke all on function public.stock_portfolio(uuid) from public;
revoke all on function public.stock_order(uuid, text, text, int) from public;
revoke all on function public.stock_issue_key() from public;
revoke all on function public.stock_reset() from public;

grant execute on function public.stock_quote() to anon, authenticated;
grant execute on function public.stock_history(text, int) to anon, authenticated;
grant execute on function public.stock_leaderboard() to anon, authenticated;
grant execute on function public.stock_trades_feed(int) to anon, authenticated;
grant execute on function public.stock_portfolio(uuid) to anon, authenticated;
grant execute on function public.stock_order(uuid, text, text, int) to anon, authenticated;
grant execute on function public.stock_issue_key() to authenticated;
grant execute on function public.stock_reset() to authenticated;
