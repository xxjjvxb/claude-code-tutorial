-- 제출(submission) 유형 추가 — feedback-setup.sql 실행 이후에 한 번 실행하세요.
alter table public.feedback drop constraint if exists feedback_type_check;
alter table public.feedback add constraint feedback_type_check
  check (type in ('question', 'report', 'submission'));
