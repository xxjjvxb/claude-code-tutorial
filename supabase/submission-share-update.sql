-- 제출물 공유 — feedback-setup.sql · submission-update.sql 실행 이후에 한 번 실행하세요.
-- 관리자가 shared로 켠 제출물만 승인된 수강생에게 보입니다.

alter table public.feedback add column if not exists shared boolean not null default false;

-- 승인된 수강생: 공유된 제출물 조회 (본인 행 조회 정책과 별개로 추가)
drop policy if exists "fb_shared_select" on public.feedback;
create policy "fb_shared_select" on public.feedback
  for select to authenticated
  using (
    type = 'submission' and shared = true
    and exists (
      select 1 from public.access_requests a
      where a.user_id = auth.uid() and a.status = 'approved'
    )
  );
