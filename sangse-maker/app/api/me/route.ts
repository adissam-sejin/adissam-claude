import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/claude";
import { isImageEnabled } from "@/lib/gemini";

/** 로그인 상태 + 크레딧 잔액 + 기능 설정 여부 */
export async function GET() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const features = { ai: !isDemoMode(), image: isImageEnabled(), payments: !!process.env.TOSS_SECRET_KEY };
  if (!data.user) return NextResponse.json({ user: null, features });
  const { data: profile } = await supabase.from("profiles").select("credits").eq("id", data.user.id).single();
  return NextResponse.json({ user: { id: data.user.id, email: data.user.email }, credits: profile?.credits ?? 0, features });
}
