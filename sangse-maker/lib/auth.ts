import type { User } from "@supabase/supabase-js";
import { supabaseAnon, supabaseServer } from "./supabase/server";
import { GenerationError } from "./claude";

export async function requireUser(): Promise<{ user: User; supabase: Awaited<ReturnType<typeof supabaseServer>> }> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new GenerationError("로그인이 필요해요.", 401);
  return { user: data.user, supabase };
}

function secret() {
  const s = process.env.SERVER_SECRET;
  if (!s) throw new GenerationError("서버 설정 오류: SERVER_SECRET 이 없어요.", 500);
  return s;
}

/** 크레딧 변경. 음수면 차감(잔액 부족 시 402), 양수면 지급/환불. 새 잔액을 돌려줌 */
export async function changeCredits(userId: string, delta: number, reason: string, ref?: string): Promise<number> {
  if (delta === 0) return -1;
  const { data, error } = await supabaseAnon().rpc("app_change_credits", {
    p_secret: secret(),
    p_user: userId,
    p_delta: delta,
    p_reason: reason,
    p_ref: ref ?? null,
  });
  if (error) {
    if (error.message.includes("insufficient_credits")) throw new GenerationError("크레딧이 부족해요. 충전 후 다시 시도해 주세요.", 402);
    throw new GenerationError(`크레딧 처리 오류: ${error.message}`, 500);
  }
  return data as number;
}

/** 크레딧을 먼저 차감하고 작업 실행, 실패하면 자동 환불 */
export async function withCredits<T>(userId: string, cost: number, reason: string, fn: () => Promise<T>): Promise<T & { credits?: number }> {
  if (cost <= 0) return fn() as Promise<T & { credits?: number }>;
  const after = await changeCredits(userId, -cost, reason);
  try {
    const result = await fn();
    return { ...(result as object), credits: after } as T & { credits?: number };
  } catch (err) {
    await changeCredits(userId, cost, `${reason} 실패 환불`).catch((e) => console.error("refund failed", e));
    throw err;
  }
}

export const serverSecret = secret;
