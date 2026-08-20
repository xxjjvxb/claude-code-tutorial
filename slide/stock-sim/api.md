# 주식 시뮬 API 명세서

바이브코딩 7장 실습용 가상 주식 시장. 이 문서를 통째로 Claude에게 붙여넣으면 트레이딩 앱을 만들 수 있습니다.

- **Base URL**: `https://vibecoding-cc.vercel.app/api/stock`
- **인증**: 모든 요청 헤더에 `X-API-Key: 내키` — 키 발급은 강의자료 사이트 `/slide/stock-sim/key.html`
- **응답 형식**: JSON. 실패 시 `{"error":"이유"}` + 4xx 상태코드.

## 기본 규칙

- 종목 3개: `A` (1만원대) · `B` (2.5만원대) · `C` (500원대). 시작 자금 1,000,000원.
- **수수료**: 매수 주문에만 체결 금액의 **0.02%** (매도는 무료).
- 공매도 없음(보유 수량만 매도 가능) · 잔고 초과 매수 불가.
- 가격은 서버가 초 단위로 갱신 — 시세 조회는 **1초에 한 번이면 충분**(더 빨리 불러도 같은 값).
- **주문은 키당 1초에 1회** — 넘기면 `429` 에러.

## 엔드포인트

### GET /price — 3종목 현재가·거래량

```
GET https://vibecoding-cc.vercel.app/api/stock/price
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
- `seconds`: 10~3600 (기본 600). 길면 포인트가 자동 압축됩니다.

응답:

```json
{
  "symbol": "A",
  "series": [
    {"t": "2026-08-20T02:00:00+00:00", "price": 10201.1, "volume": 52},
    {"t": "2026-08-20T02:00:01+00:00", "price": 10203.4, "volume": 48}
  ]
}
```

### POST /order — 시장가 주문

```
POST https://vibecoding-cc.vercel.app/api/stock/order
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
GET https://vibecoding-cc.vercel.app/api/stock/portfolio
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

### GET /trades?seconds=3600 — 전체 참여자 최근 체결 (최대 400건, 최신순)

응답:

```json
{"rows": [{"name": "김서연", "symbol": "A", "side": "buy", "qty": 10, "price": 10234.5, "t": "..."}]}
```

## 앱 만들 때 팁

- 시세 폴링 1초 · 차트 갱신 2~3초 · 계좌 갱신 5초 정도면 충분합니다.
- 통신은 백그라운드 스레드에서 — GUI가 얼지 않게.
- 주문 버튼은 연타 방지(1초 1회)를 앱에서도 걸어두면 429를 안 봅니다.
- 수업 시작 시 관리자가 시장을 초기화할 수 있습니다(전원 잔고 100만·체결 내역 삭제·새 시세). 키는 그대로 쓸 수 있습니다.
- 시뮬이 꺼져 있으면 조회는 빈 결과, 주문은 `sim is off` 에러가 옵니다 — 수업 시간에 켜집니다.
