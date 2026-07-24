// 열람 게이트 설정 — Supabase 프로젝트 값으로 교체하세요 (ACCESS-SETUP.md 참고)
// 값이 PASTE_ 상태인 동안에는 게이트가 꺼져 있어 사이트가 전체 공개로 동작합니다.
export const SUPABASE_URL = 'PASTE_SUPABASE_URL';           // 예: https://abcdefgh.supabase.co
export const SUPABASE_ANON_KEY = 'PASTE_SUPABASE_ANON_KEY'; // Settings → API → anon public key (공개용 키)
export const ADMIN_EMAIL = 'minkyu.ast@gmail.com';          // 관리자(승인 권한) 구글 계정
export const GATE_ENABLED = !SUPABASE_URL.includes('PASTE_');
