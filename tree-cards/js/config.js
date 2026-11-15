/*
 * 사이트 설정
 * ------------------------------------------------------------------
 * SUPABASE_URL / SUPABASE_ANON_KEY 를 채우면 실제 서버(Supabase)에 저장됩니다.
 * 비워 두면 "미리보기 모드"로 동작하며, 데이터는 이 브라우저에만 저장됩니다.
 * (설정 방법은 README.md 참고)
 */
window.TREE_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // 미리보기 모드에서만 쓰이는 관리자 비밀번호 (실서버 비밀번호는 Supabase에 저장됩니다)
  PREVIEW_ADMIN_PASSWORD: "admin1234",
};
