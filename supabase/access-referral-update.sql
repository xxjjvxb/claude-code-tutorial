-- 열람 신청에 "어떻게 여기로 오셨나요?" 유입 경로 컬럼 추가.
-- Supabase SQL Editor에 붙여넣어 실행하세요. (기존 access-setup.sql 실행된 프로젝트용)

alter table public.access_requests add column if not exists referral text;
