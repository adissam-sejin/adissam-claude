import { randomUUID } from "node:crypto";
import { requireUser, serverSecret } from "@/lib/auth";
import { GenerationError } from "@/lib/claude";
import { findPackage } from "@/lib/pricing";
import { handle } from "@/lib/route-helpers";
import { supabaseAnon } from "@/lib/supabase/server";

/** 결제 주문 생성: 금액은 서버의 상품표로만 결정 */
export async function POST(req: Request) {
  const { packageId } = (await req.json()) as { packageId: string };
  return handle(async () => {
    const { user } = await requireUser();
    const pkg = findPackage(packageId);
    if (!pkg) throw new GenerationError("상품을 찾을 수 없어요.", 400);
    if (!process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || !process.env.TOSS_SECRET_KEY) throw new GenerationError("결제가 아직 설정되지 않았어요.", 503);
    const orderId = `SM-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const { error } = await supabaseAnon().rpc("app_create_order", {
      p_secret: serverSecret(),
      p_user: user.id,
      p_order_id: orderId,
      p_package: pkg.id,
      p_amount: pkg.price,
      p_credits: pkg.credits,
    });
    if (error) throw new GenerationError(`주문 생성 실패: ${error.message}`, 500);
    return {
      orderId,
      amount: pkg.price,
      orderName: `상세메이트 ${pkg.name} ${pkg.credits}크레딧`,
      customerKey: `user_${user.id}`,
      customerEmail: user.email,
    };
  });
}
