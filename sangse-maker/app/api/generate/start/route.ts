import { changeCredits, requireUser } from "@/lib/auth";
import { isDemoMode, requireAI } from "@/lib/claude";
import { issueGenToken } from "@/lib/gen-token";
import { COSTS } from "@/lib/pricing";
import { handle } from "@/lib/route-helpers";

/** 상세페이지 생성 시작: 크레딧 차감 후 생성 이용권 발급 */
export async function POST() {
  return handle(async () => {
    const { user } = await requireUser();
    requireAI();
    if (isDemoMode()) return { token: "demo", demo: true };
    const credits = await changeCredits(user.id, -COSTS.generate, "상세페이지 생성");
    return { token: issueGenToken(user.id), credits };
  });
}
