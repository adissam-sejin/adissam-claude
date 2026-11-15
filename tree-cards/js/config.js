/*
 * 사이트 설정
 * ------------------------------------------------------------------
 * SUPABASE_URL / SUPABASE_KEY 가 채워져 있으면 실제 서버에 저장되고,
 * 저장된 내용은 노션 DB 로 자동 복사됩니다.
 * 비워 두면 "미리보기 모드"로 동작하며 데이터는 이 브라우저에만 저장됩니다.
 * (SUPABASE_KEY 는 공개돼도 되는 publishable 키입니다)
 */
window.TREE_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_KEY: "",

  // 미리보기 모드에서만 쓰이는 관리자 비밀번호 (실제 비밀번호는 서버에 저장됩니다)
  PREVIEW_ADMIN_PASSWORD: "admin1234",
};
