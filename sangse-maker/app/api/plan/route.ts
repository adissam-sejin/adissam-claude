import { PlanSchema, type ProductInput } from "@/lib/schema";
import { PLAN_SYSTEM, inputToText } from "@/lib/prompts";
import { callStructured, imageBlocks, isDemoMode, requireAI } from "@/lib/claude";
import { demoPlan } from "@/lib/demo";
import { demoDelay, handle } from "@/lib/route-helpers";
import { requireUser } from "@/lib/auth";

export const maxDuration = 60;

/** 기획 초안: 섹션 구성과 핵심 메시지 */
export async function POST(req: Request) {
  const { images, input } = (await req.json()) as { images: string[]; input: ProductInput };
  return handle(async () => {
    await requireUser();
    requireAI();
    if (isDemoMode()) {
      await demoDelay(1200);
      return { ...demoPlan(input), demo: true };
    }
    const make = () => callStructured({
      system: PLAN_SYSTEM,
      schema: PlanSchema,
      effort: "low",
      maxTokens: 16000,
      content: [
        ...imageBlocks(images),
        { type: "text", text: `[상품 정보]\n${inputToText(input)}\n\n사진은 총 ${images.length}장입니다. 기획 초안을 만들어 주세요.` },
      ],
    });
    // 섹션이 너무 적게 나오면 한 번 더 (8~11개 목표)
    let plan = await make();
    if (plan.sections.length < 7) {
      const again = await make().catch(() => null);
      if (again && again.sections.length > plan.sections.length) plan = again;
    }
    return plan;
  });
}
