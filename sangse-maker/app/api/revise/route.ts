import { SectionSchema, type ProductInput, type Section } from "@/lib/schema";
import { REVISE_SYSTEM, reviseUserText } from "@/lib/prompts";
import { callStructured, isDemoMode } from "@/lib/claude";
import { demoDelay, handle } from "@/lib/route-helpers";
import { requireUser, withCredits } from "@/lib/auth";
import { COSTS } from "@/lib/pricing";

export const maxDuration = 120;

/** 섹션 하나를 말로 수정 ("더 짧게", "20대 말투로" 등) */
export async function POST(req: Request) {
  const { section, instruction, input } = (await req.json()) as {
    section: Section;
    instruction: string;
    input: ProductInput;
  };
  return handle(async () => {
    const { user } = await requireUser();
    if (isDemoMode()) {
      await demoDelay();
      return { ...section, body: `${section.body}\n(데모 모드: "${instruction}" 요청은 API 키 연결 후 실제로 반영돼요)`.trim(), demo: true };
    }
    return withCredits(user.id, COSTS.revise, "섹션 AI 수정", async () => {
    const revised = await callStructured({
      system: REVISE_SYSTEM,
      schema: SectionSchema,
      effort: "low",
      maxTokens: 8000,
      content: [{ type: "text", text: reviseUserText(section, instruction, input) }],
    });
    return { ...revised, type: section.type };
    });
  });
}
