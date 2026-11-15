/* 배포 설정. 비워 두면 "데모 모드"(이 기기 브라우저에만 저장)로 동작합니다.
 * Supabase 프로젝트를 만든 뒤 URL과 anon(publishable) 키를 넣으면 실제 카카오/네이버 로그인과 서버 저장이 켜집니다.
 * anon 키는 공개돼도 되는 키입니다(RLS로 보호). service_role 키는 절대 넣지 마세요. */
window.C8_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  KAKAO_PROVIDER: 'kakao',          // Supabase 기본 제공
  NAVER_PROVIDER: 'custom:naver',   // Supabase "Custom OAuth provider"로 등록한 식별자
};
