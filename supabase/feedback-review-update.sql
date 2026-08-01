-- 신고 검수 파이프라인 업데이트 — Supabase SQL Editor에 붙여넣어 실행하세요.
-- (feedback-setup.sql 실행 이후에 실행)
--
-- 파이프라인: open(신고) → fixed(에이전트 대응, 검수 대기) → resolved(관리자 검수완료)
--            재신고 시 open으로 복귀 (review_note에 사유)

alter table public.feedback drop constraint if exists feedback_status_check;
alter table public.feedback add constraint feedback_status_check
  check (status in ('open', 'fixed', 'resolved'));

alter table public.feedback add column if not exists fix_note    text;  -- 에이전트가 남기는 대응 요약
alter table public.feedback add column if not exists review_note text;  -- 재신고 사유

-- 2026-08-01 일괄 반영분(id 41~61)을 검수 대기로 전환 — 슬라이드에서 재신고/검수완료 해주세요.
update public.feedback f
set status = 'fixed', fix_note = v.note, resolved_at = null
from (values
  (41, '이해 덱: "시연 완료" → "다양한 프로젝트 수행 가능"'),
  (42, '이해 덱: Anthropic 연혁에 2026(Fable 5·Opus 5) 추가'),
  (43, '셋업 덱: onorca.dev 하이퍼링크 추가'),
  (44, '셋업 덱: 설치 순서 재구성 — 47번과 통합, git→claude→orca→gh→node 확정'),
  (45, '셋업 덱: git 설치(STEP 01)와 gh 설치(STEP 06)를 별도 슬라이드로 분리'),
  (46, '셋업 덱: gh 설치를 winget 대신 cli.github.com msi 다운로드 방식으로'),
  (47, '셋업 덱: 8스텝 전면 재배열 — git→claude→orca(홈베이스)→gh→node'),
  (48, '셋업 덱: nodejs.org 하이퍼링크 추가'),
  (49, '터미널 덱: Orca 목업을 실제 레이아웃(사이드바+우측 전체 터미널)으로 교체'),
  (50, '터미널 덱: 내장 터미널 열기 강조 제거 — "오른쪽에 바로 보임"으로'),
  (51, '터미널 덱: 슬래시 카탈로그에서 /agents 제거 (→ /login·/exit 대체)'),
  (52, '터미널 덱: /usage 제거 — 사용량은 Orca 하단바 상시 표시로 통일'),
  (53, '터미널 덱: "1인 1분 발표" 카드 → "저장하고 한숨 돌리기"로 교체'),
  (54, '자기소개 덱: 인터뷰 프롬프트를 "md 파일로 생성해줘"로 (3곳)'),
  (55, '자기소개 덱: 미션 2를 좌측 스텝·우측 프롬프트 2단 배치로'),
  (56, '자기소개 덱: /usage → Orca 하단바 사용량 확인으로'),
  (57, '자기소개 덱: # 메모리 문법 카드 → Esc×2 되돌아가기로 교체'),
  (58, 'Git 덱: 저장소 만들고 "주소 주고 올려줘" 프롬프트 슬라이드 신설'),
  (59, '배포 덱: 중복 STEP 1(저장소 만들기+커밋) 슬라이드 삭제, 캡처는 참고로 재라벨'),
  (60, '배포 덱: vercel.com 하이퍼링크 추가'),
  (61, '배포 덱: Hobby(개인·무료) 가입 안내 강화 + 가입 화면 캡처 슬롯 추가')
) as v(id, note)
where f.id = v.id;
