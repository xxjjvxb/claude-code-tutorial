# 주식 시뮬 API 명세서

바이브코딩 7장 실습용 가상 주식 시장. 이 문서를 통째로 Claude에게 붙여넣으면 트레이딩 앱을 만들 수 있습니다.

- **Base URL**: `https://vibe.219.co.kr/api/stock`
- **인증**: 모든 요청 헤더에 `X-API-Key: 내키` — 키 발급은 강의자료 사이트 `/slide/stock-sim/key.html`
- **응답 형식**: JSON. 실패 시 `{"error":"이유"}` + 4xx 상태코드.

## 기본 규칙

- 종목 3개: `A` (1만원대) · `B` (2.5만원대) · `C` (500원대). 시작 자금 1,000,000원.
- **수수료**: 매수 주문에만 체결 금액의 **0.02%** (매도는 무료).
- 공매도 없음(보유 수량만 매도 가능) · 잔고 초과 매수 불가.
- 가격은 서버가 초 단위로 갱신되지만 응답은 캐시됩니다 — `/price` 2초, `/history`·`/trades` 3초, `/leaderboard` 5초. **그보다 자주 불러도 똑같은 값이 옵니다.**
- **주문은 키당 1초에 1회** — 넘기면 `429` 에러.

## 엔드포인트

### GET /price — 3종목 현재가·거래량

```
GET https://vibe.219.co.kr/api/stock/price
X-API-Key: 내키
```

응답:

```json
{
  "t": 1787159288,
  "quotes": [
    {"symbol": "A", "price": 10234.5, "volume": 57},
    {"symbol": "B", "price": 25453.2, "volume": 43},
    {"symbol": "C", "price": 501.8, "volume": 66}
  ]
}
```

### GET /history?symbol=A&seconds=600 — 최근 N초 시세

- `symbol`: A/B/C (필수)
- `seconds`: 10~3600 (기본 600). 응답은 항상 최대 151개 포인트로 압축됩니다 — 포인트 간격 = 올림(seconds ÷ 150)초. 예: 600초 → 4초 간격, 3600초 → 24초 간격. `volume`은 그 간격 동안의 합계입니다.

응답:

```json
{
  "symbol": "A",
  "series": [
    {"t": "2026-08-20T02:00:00+00:00", "price": 10201.1, "volume": 210},
    {"t": "2026-08-20T02:00:04+00:00", "price": 10203.4, "volume": 196}
  ]
}
```

### POST /order — 시장가 주문

```
POST https://vibe.219.co.kr/api/stock/order
X-API-Key: 내키
Content-Type: application/json

{"symbol": "A", "side": "buy", "qty": 10}
```

- `symbol`: A/B/C · `side`: buy/sell · `qty`: 1~10000
- 체결가는 주문 시점의 시장가 · 매수 수수료 0.02% (매도는 `fee: 0`)

성공 응답 (체결 결과 + 갱신된 계좌):

```json
{
  "filled": 10,
  "exec_price": 10234.5,
  "fee": 20.47,
  "cash": 897635,
  "pos_a": 10,
  "pos_b": 0,
  "pos_c": 0
}
```

실패 응답 예:

- `429` `{"error":"rate limit: 1 order per second"}` — 1초에 2번 주문
- `400` `{"error":"not enough cash (need 102365, have 50000)"}` — 잔고 부족
- `400` `{"error":"not enough position (have 3)"}` — 보유 초과 매도
- `401` `{"error":"invalid api key"}` — 키 오류

### GET /portfolio — 내 계좌

```
GET https://vibe.219.co.kr/api/stock/portfolio
X-API-Key: 내키
```

응답:

```json
{
  "name": "김서연",
  "cash": 897635,
  "pos_a": 10, "pos_b": 0, "pos_c": 0,
  "value": 1000139,
  "pnl_pct": 0.01,
  "trades": [
    {"t": "2026-08-20T02:35:26+00:00", "symbol": "A", "side": "buy", "qty": 10, "price": 10234.5}
  ]
}
```

- `value` = 현금 + 보유 주식 평가액 · `pnl_pct` = 수익률(%) · `trades` = 내 최근 체결 20건 (최신순)

### GET /mytrades?limit=100 — 내 체결 내역

- `limit`: 1~400 (기본 100). 최신순. 간단한 용도면 `/portfolio`의 `trades`(최근 20건)로도 충분합니다.

응답:

```json
{"rows": [{"symbol": "A", "side": "buy", "qty": 10, "price": 10234.5, "fee": 20.47, "t": "2026-08-20T02:35:26+00:00"}]}
```

### GET /leaderboard — 수익률 순위

응답:

```json
{"rows": [{"name": "김서연", "value": 1042805, "pnl_pct": 4.28}]}
```

### GET /trades?seconds=3600 — 시장 체결 히스토리 (익명)

시장 전체에서 일어난 체결 기록 — 누가 거래했는지는 공개하지 않습니다. `seconds` 10~86400 (기본 3600), 최대 400건 최신순.

응답:

```json
{"rows": [{"symbol": "A", "side": "buy", "qty": 10, "price": 10234.5, "t": "2026-08-20T02:35:26+00:00"}]}
```

## 앱 만들 때 팁

- 시세 폴링 2초 · 차트 갱신 3초 · 계좌 갱신 5초 정도면 충분합니다. 더 자주 불러봤자 캐시된 같은 값이고, 전원이 동시에 하면 시장이 느려집니다.
- 통신은 백그라운드 스레드에서 — GUI가 얼지 않게.
- 주문 버튼은 연타 방지(1초 1회)를 앱에서도 걸어두면 429를 안 봅니다.
- 수업 시작 시 관리자가 시장을 초기화할 수 있습니다(전원 잔고 100만·체결 내역 삭제·새 시세). 키는 그대로 쓸 수 있습니다.
- 시뮬이 꺼져 있으면 조회는 빈 결과, 주문은 `sim is off` 에러가 옵니다 — 수업 시간에 켜집니다.
