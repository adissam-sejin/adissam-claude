import { requireUser, serverSecret } from "@/lib/auth";
import { GenerationError } from "@/lib/claude";
import { handle } from "@/lib/route-helpers";
import { supabaseAnon } from "@/lib/supabase/server";

/** 결제 승인: 주문 금액 검증 → 토스 승인 API → 크레딧 지급 */
export async function POST(req: Request) {
  const { paymentKey, orderId, amount } = (await req.json()) as { paymentKey: string; orderId: string; amount: number };
  return handle(async () => {
    const { user } = await requireUser();
    const db = supabaseAnon();
    const { data: order, error } = await db.rpc("app_get_order", { p_secret: serverSecret(), p_order_id: orderId });
    if (error || !order?.order_id) throw new GenerationError("주문을 찾을 수 없어요.", 404);
    if (order.user_id !== user.id) throw new GenerationError("다른 계정의 주문이에요.", 403);
    if (order.status === "done") {
      const { data: p } = await db.rpc("app_complete_order", { p_secret: serverSecret(), p_order_id: orderId, p_payment_key: paymentKey, p_method: null });
      return { ok: true, credits: p, added: order.credits, already: true };
    }
    if (Number(amount) !== order.amount) {
      await db.rpc("app_fail_order", { p_secret: serverSecret(), p_order_id: orderId });
      throw new GenerationError("결제 금액이 주문 금액과 달라요. 결제가 취소되었어요.", 400);
    }

    const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString("base64")}`,
        "Content-Type": "application/json",
        "Idempotency-Key": orderId,
      },
      body: JSON.stringify({ paymentKey, orderId, amount: order.amount }),
    });
    const toss = await res.json().catch(() => ({}));
    if (!res.ok) {
      await db.rpc("app_fail_order", { p_secret: serverSecret(), p_order_id: orderId });
      throw new GenerationError(`결제 승인 실패: ${toss.message ?? res.status}`, 400);
    }
    const { data: balance, error: e2 } = await db.rpc("app_complete_order", {
      p_secret: serverSecret(),
      p_order_id: orderId,
      p_payment_key: paymentKey,
      p_method: toss.method ?? null,
    });
    if (e2) throw new GenerationError(`크레딧 지급 오류 (고객센터 문의: ${orderId})`, 500);
    return { ok: true, credits: balance, added: order.credits };
  });
}
