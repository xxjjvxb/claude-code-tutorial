// 열람 게이트 설정 — Supabase 프로젝트 값 (ACCESS-SETUP.md 참고)
// URL과 anon key가 모두 채워져야 게이트가 켜집니다. 하나라도 PASTE_ 상태면 전체 공개로 동작.
export const SUPABASE_URL = 'https://khjevjuoudbsbkzrhfkx.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_iG5xWaXa_CWtdXDEJS0aug_saBT3x4B'; // publishable key (공개용)
export const ADMIN_EMAIL = 'xxjjvxb@gmail.com';             // 관리자(승인 권한) 구글 계정
export const GATE_ENABLED = !SUPABASE_URL.includes('PASTE_') && !SUPABASE_ANON_KEY.includes('PASTE_');
