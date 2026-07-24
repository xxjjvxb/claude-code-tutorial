# 강의자료 열람 게이트 — 설정 절차

구글 로그인 → 열람 신청 → 관리자 승인 → `/slide/*` 열람. 승인 검증은 Vercel Edge Middleware가 서버단에서 수행하므로 링크 공유·주소 직접 입력으로는 우회할 수 없습니다.

`auth-config.js`가 placeholder(PASTE_…) 상태인 동안에는 **게이트가 꺼져 있어 전체 공개**로 동작합니다. 아래 1~4를 마치고 값을 채워 푸시하는 순간 게이트가 켜집니다.

## 1. Supabase 프로젝트

1. [supabase.com](https://supabase.com) → New project (이름 예: `lecture-gate`, 리전 Northeast Asia)
2. **Settings → API**에서 두 값을 복사해 둡니다: `Project URL`, `anon public` key

## 2. 구글 로그인 연결

1. [console.cloud.google.com](https://console.cloud.google.com) → 프로젝트 선택 → **API 및 서비스 → 사용자 인증 정보 → OAuth 클라이언트 ID 만들기** (유형: 웹 애플리케이션)
   - 승인된 리디렉션 URI: `https://<프로젝트ref>.supabase.co/auth/v1/callback`
2. Supabase → **Authentication → Sign In / Providers → Google**: 발급받은 클라이언트 ID·시크릿 입력, Enable
3. Supabase → **Authentication → URL Configuration**:
   - Site URL: `https://<배포 도메인>` (예: `https://xxx.vercel.app`)
   - Redirect URLs에 추가: `https://<배포 도메인>/*`

## 3. 테이블 + 권한 (SQL)

Supabase → **SQL Editor** → `supabase/access-setup.sql` 내용 붙여넣고 Run.
관리자 이메일이 `minkyu.ast@gmail.com`이 아니면 SQL 안의 이메일 두 곳을 먼저 수정하세요.

## 4. 설정값 입력 → 배포

`auth-config.js`의 `SUPABASE_URL`, `SUPABASE_ANON_KEY`에 1번에서 복사한 값을 넣고 커밋·푸시.
(anon key는 공개되어도 되는 키입니다 — 실제 권한은 RLS가 통제)

## 5. 동작 확인

1. 배포 주소 접속 → `/slide/` 접근 시 로그인 페이지로 이동하는지
2. 관리자 계정으로 구글 로그인 → 자동 통과(승인 불필요) → `/admin.html` 접속 확인
3. 다른 구글 계정으로 로그인 → "열람 신청" → admin에서 승인 → 새로고침 후 입장 확인

## 운영 참고

- **승인/거절은 즉시 반영**됩니다 (미들웨어가 매 페이지 요청마다 상태 확인).
- 로그인 세션 토큰은 약 1시간마다 갱신됩니다. 슬라이드를 열어 둔 채 오래 지나 만료되면 로그인 페이지로 튕기는데, 그 페이지에서 자동 갱신되어 보던 곳으로 되돌아갑니다.
- HTML 문서는 토큰+승인 전체 검증, 이미지·CSS 등 자산은 토큰 존재만 확인합니다(속도).
- **6장 크롤링 실습 주의**: 공통 예제가 이 강의 사이트를 크롤링하므로, 게이트가 켜진 뒤에는 수강생이 로그인·승인된 브라우저 세션으로 실습해야 합니다. 수업 전 전원 승인해 두세요.
- 게이트를 잠시 끄려면 `auth-config.js`의 URL 값을 placeholder로 되돌려 푸시하면 됩니다.
