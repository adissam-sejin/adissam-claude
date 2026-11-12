import { PlanSchema, type ProductInput } from "@/lib/schema";
import { PLAN_SYSTEM, inputToText } from "@/lib/prompts";
import { callStructured, imageBlocks, isDemoMode } from "@/lib/claude";
import { demoPlan } from "@/lib/demo";
import { demoDelay, handle } from "@/lib/route-helpers";

export const maxDuration = 180;

/** 기획 초안: 섹션 구성과 핵심 메시지 */
export async function POST(req: Request) {
  const { images, input } = (await req.json()) as { images: string[]; input: ProductInput };
  return handle(async () => {
    if (isDemoMode()) {
      await demoDelay(1200);
      return { ...demoPlan(input), demo: true };
    }
    return callStructured({
      system: PLAN_SYSTEM,
      schema: PlanSchema,
      effort: "medium",
      maxTokens: 16000,
      content: [
        ...imageBlocks(images),
        { type: "text", text: `[상품 정보]\n${inputToText(input)}\n\n사진은 총 ${images.length}장입니다. 기획 초안을 만들어 주세요.` },
      ],
    });
  });
}
