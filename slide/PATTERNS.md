# Slide Patterns — 표준 가이드

Day 2~5 강의안 작성 시 이 문서를 참고. 모든 패턴은 4:3 stage(1920×1440 기준)에서 넘침 없이 들어가도록 설계.

## 1. Slide 골격 (필수)

```html
<section class="slide is-standard">
  <div class="slide__eyebrow">CATEGORY · 부제</div>
  <h2 class="slide__title">메인 메시지 — <span class="accent">강조어</span></h2>
  <div class="slide__body">
    <!-- 콘텐츠 (1~3 블록 권장) -->
  </div>
  <p class="slide__note">참고/주석 1줄 (선택)</p>
</section>
```

**규칙:**
- `slide__body` 안에는 **블록 3개 이하** 권장. 4개부터 넘침 위험.
- `slide__note`는 **반드시 slide__body 바깥**에 둘 것. content-card 안에 nested 금지.
- 한 슬라이드에 한 메시지 — `slide__title`에 한 줄 요약 가능해야 함.

## 2. 콘텐츠 양 가이드

| 패턴 | 권장 항목 수 | 한도 |
|---|---|---|
| `grid-3` (카드 3개) | 3 | 3 (고정) |
| `grid-4` (카드 4개) | 4 | 4 (고정) |
| `setup-grid` (단계 그리드) | 6~7 | 9 |
| `cmd-cards` 표준 | 3~4 | 4 |
| `cmd-cards--compact` | 5~6 | 6 |
| `step-list` 표준 | 3~4 | 4 |
| `step-list--compact` | 4~5 | 5 |
| `content-card__list` (ul) | 3~4 | 5 |
| `content-card__list` (compact) | 3 | 4 |
| `trouble-list` 표준 | 3~4 | 4 |
| `trouble-list--compact` | 5 | 5 |
| `path-tree` lines | 5~6 | 7 |
| `bg-compare__quote` lines | 4~5 | 5 |

## 3. Compact Modifier 사용 시기

밀도 높은 슬라이드는 compact 모디파이어를 적용:

- `.content-card--compact` — content-card 5+ 항목 또는 two-col 양쪽 동시 사용 시
- `.cmd-cards--compact` — cmd-card 5개 이상 또는 etym 라인 살릴 때
- `.trouble-list--compact` — trouble-item 5개 이상
- `.caveat-grid--compact` — caveat-card 4개 (2x2)
- `.step-list--compact` — step-list 4개 이상
- `.code-block--inline-xs` — content-card 안에 들어가는 작은 코드블록

## 4. 슬라이드 템플릿 5종

### A. is-standard (기본)
```html
<section class="slide is-standard">
  <div class="slide__eyebrow">...</div>
  <h2 class="slide__title">...</h2>
  <div class="slide__body">...</div>
</section>
```

### B. is-statement (statement-grid 좌:우 = 1.25:1)
```html
<section class="slide is-statement">
  <div class="statement-grid">
    <div class="statement-text">
      <div class="slide__eyebrow">...</div>
      <h2 class="statement__lead">...</h2>
      <p class="statement__caption">...</p>
      <div class="statement__points">...</div>
    </div>
    <div class="statement-visual">...</div>
  </div>
</section>
```
변형: `.statement-grid--visual-wide` (1:1.25, 시각자료 우선)

### C. is-feature (제목 전체 폭 + 본문 그리드)
```html
<section class="slide is-feature">
  <div class="feature-head">
    <div class="slide__eyebrow">...</div>
    <h2 class="feature-head__title">...</h2>
  </div>
  <div class="feature-body">
    <div class="feature-text">...</div>
    <div class="feature-visual">...</div>
  </div>
</section>
```

### D. is-cover (표지)
### E. is-section (섹션 인트로)

## 5. 사진/이미지 자리

실제 사진 미준비 상태에서 자리만 잡을 때:

```html
<div class="photo-slot photo-slot--landscape">
  <div class="photo-slot__icon">◧</div>
  <div class="photo-slot__label">사진 라벨</div>
  <div class="photo-slot__hint">설명 힌트</div>
</div>
```

변형:
- `.photo-slot--portrait` (1:1)
- `.photo-slot--landscape` (16:10)
- `.photo-slot--square` (1:1)

추후 사진 들어갈 때는 `<img>`로 교체.

## 6. 색·강조

- 강조어: `<span class="accent">텍스트</span>` — orange #fe6e00
- 코드 인라인: `<code>...</code>`
- 강한 강조: `<strong>...</strong>`
- 위험: `var(--color-danger)` red
- 코드 블록: `.code-block` (다크 테마) + dot 헤더

## 7. 한국어 처리

전역으로 `word-break: keep-all; overflow-wrap: break-word;` 적용됨.
긴 영문 명령은 ` · ` 또는 ` → ` 로 자연스러운 끊김 유도.

## 8. 슬라이드 검토 체크리스트

새 슬라이드 작성/수정 시:

- [ ] slide__body 안 블록 3개 이하?
- [ ] 카드 항목 수가 위 표 권장 범위?
- [ ] 5+ 항목인데 compact modifier 적용했나?
- [ ] slide__note는 slide__body 바깥에?
- [ ] 한 줄 요약(slide__title)이 슬라이드 내용을 커버하나?
- [ ] 코드/경로 인라인은 `<code>`로?
- [ ] 영문 긴 문구는 ` · ` ` → `로 끊김 처리?
- [ ] 사진 자리는 photo-slot으로?

---

## 9. 8:9 세로 덱 (claude-desktop-1day 전용)

`styles/deck-89.css`를 `deck.css` 뒤에 로드하면 스테이지가 8:9 세로형으로 바뀜 (좌-교안/우-실습 분할 운영용). 이 덱 전용 컴포넌트:

| 컴포넌트 | 용도 | 규칙 |
|---|---|---|
| `prompt-card` | 복사 가능한 프롬프트 블록 | head(라벨+`[data-copy]` 버튼) + `pre.prompt-card__body[data-no-nav]`. 복사 버튼은 항상 우상단. `scripts/prompt-copy.js` 필요 |
| `prompt-pair` | 프롬프트 2장 세로 묶음 | 한 STEP당 표준/변형 2장. 3장 이상이면 `prompt-card--compact` |
| `step-insight` | ⚠️ 조심 + 💡 가져갈 것 2행 | 모든 실습 STEP 하단. `__row--caution` / `__row--takeaway` |
| `challenge` | 도전 과제 박스 (점선 테두리) | `challenge__list`로 항목별 줄 구분. 워크스페이스 `도전과제/*.md`와 1:1 |
| `folder-pin` | 작업 폴더 강조 칩 | 각 티어 표지 필수. `실습자료/0N-*/ ` 경로 |
| `pattern-grid` | What/Why/Sign/Antidote 4행 | T7 위험 패턴 전용. 라벨 한국어 병기 (`What · 무엇`) |
| `cover-onboard` | 표지 하단 QR+입장 안내 | 0-setup 표지 전용 |
| `photo-slot[data-img]` | modify-mode 드롭존 | `?mode=modify` 접속 시 이미지 드래그&드롭 → imgs/에 저장 (`scripts/slide-modify.js`) |
| `grid-2` / `flow-89` / `img-frame` | 2열 그리드 / 세로 스택 / 이미지 프레임 | 세로형 기본 레이아웃 |

**이미지 규칙 (8:9)**:
- 이미지는 항상 `img-frame` 또는 `photo-slot[data-img]` 안에 — 직접 `<img>` 금지.
- 두 컨테이너 모두 **이미지를 감싸는 액자**로 동작: 비율 보존(contain), 가로 중앙, 높이 캡(스크린샷 14rem / 드롭 사진 12rem), overflow 차단.
- placeholder 상태의 photo-slot은 점선 16:10(최대 11rem) — 이미지가 들어오면(has-img) 비율 고정이 풀리고 액자가 이미지에 맞춰 수축.
- inline style로 높이 지정 금지 (% 높이는 무효 — 실제 사고 사례 있었음).
- 본문은 위에서부터 흐름(flex-start) — 8:9에선 safe center가 제목 아래 구멍을 만듦.

**8:9 전용 수칙**:
- 가로 `two-col`·`grid-4`는 좁아서 비권장 — `grid-2` 또는 `flow-89` 스택.
- 모든 프롬프트는 prompt-card로 (떠먹여주기 원칙 — 타이핑 금지).
- 콘텐츠 수정 후 반드시: `C:\Python\Python311\python.exe materials/instructor-only/_verify50.py` → 50/50 확인 + `materials/실습자료.zip` 재생성.
