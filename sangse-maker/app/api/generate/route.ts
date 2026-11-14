import { PageSchema, type Plan, type ProductInput } from "@/lib/schema";
import { GENERATE_SYSTEM, inputToText, planToText } from "@/lib/prompts";
import { callStructured, imageBlocks, isDemoMode } from "@/lib/claude";
import { demoPage } from "@/lib/demo";
import { demoDelay, handle } from "@/lib/route-helpers";
import { requireUser, withCredits } from "@/lib/auth";
import { COSTS } from "@/lib/pricing";

export const maxDuration = 300;

/** 기획 초안 → 카피·레이아웃·컬러가 들어간 상세페이지 JSON */
export async function POST(req: Request) {
  const { images, input, plan, brandColor } = (await req.json()) as {
    images: string[];
    input: ProductInput;
    plan: Plan;
    brandColor?: string;
  };
  return handle(async () => {
    const { user } = await requireUser();
    if (isDemoMode()) {
      await demoDelay(1800);
      const page = demoPage(input, images.length);
      if (brandColor) page.theme.primary = brandColor;
      return { ...page, demo: true };
    }
    return withCredits(user.id, COSTS.generate, "상세페이지 생성", async () => {
    const page = await callStructured({
      system: GENERATE_SYSTEM,
      schema: PageSchema,
      effort: "medium",
      maxTokens: 48000,
      content: [
        ...imageBlocks(images),
        {
          type: "text",
          text: [
            `[상품 정보]\n${inputToText(input)}`,
            `[기획 초안]\n${planToText(plan)}`,
            brandColor ? `[브랜드 메인 컬러] ${brandColor} (theme.primary 로 사용)` : "",
            `사진은 총 ${images.length}장입니다 (imageIndex 0~${images.length - 1}). 상세페이지를 완성해 주세요.`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    });
    // 존재하지 않는 사진 번호는 -1 로 정리
    const fix = (n: number) => (n >= 0 && n < images.length ? n : -1);
    page.sections = page.sections.map((s) => ({
      ...s,
      imageIndex: fix(s.imageIndex),
      items: s.items.map((i) => ({ ...i, imageIndex: fix(i.imageIndex) })),
    }));
    return page;
    });
  });
}
