import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** 이메일 인증/비밀번호 재설정 링크 → 세션 생성 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/create";
  const next = nextParam.startsWith("/") ? nextParam : "/create";
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
