import { AnalyzeSchema, type ProductInput } from "@/lib/schema";
import { ANALYZE_SYSTEM, inputToText } from "@/lib/prompts";
import { callStructured, imageBlocks, isDemoMode } from "@/lib/claude";
import { demoAnalysis } from "@/lib/demo";
import { demoDelay, handle } from "@/lib/route-helpers";
import { requireUser } from "@/lib/auth";

export const maxDuration = 120;

/** 사진 → 상품 정보 자동 채우기 + USP 분석 */
export async function POST(req: Request) {
  const { images, input } = (await req.json()) as { images: string[]; input: Partial<ProductInput> };
  return handle(async () => {
    await requireUser();
    if (isDemoMode()) {
      await demoDelay();
      return { ...demoAnalysis(input), demo: true };
    }
    return callStructured({
      system: ANALYZE_SYSTEM,
      schema: AnalyzeSchema,
      effort: "low",
      maxTokens: 8000,
      content: [
        ...imageBlocks(images),
        { type: "text", text: `사용자가 입력한 정보(비어 있을 수 있음):\n${inputToText(input as ProductInput) || "(없음)"}` },
      ],
    });
  });
}
