import { PageSchema, emptySection, type Plan, type ProductInput, type Section, type SectionType } from "@/lib/schema";
import { GENERATE_SYSTEM, inputToText, planToText } from "@/lib/prompts";
import { callStructured, imageBlocks, isDemoMode, requireAI } from "@/lib/claude";
import { demoPage } from "@/lib/demo";
import { demoDelay, handle } from "@/lib/route-helpers";
import { requireUser } from "@/lib/auth";
import { verifyGenToken } from "@/lib/gen-token";

export const maxDuration = 60;

/** 섹션 type 별 최소 요건 — 비어 있는(성의 없는) 섹션을 찾아 재시도 */
const MIN_ITEMS: Partial<Record<SectionType, number>> = { problem: 3, features: 2, detail: 2, howto: 2, target: 3, comparison: 2, spec: 3, faq: 2, notice: 2 };
function isThin(s: Section): boolean {
  if (!s.title.trim()) return true;
  if (s.type === "hero" && !s.body.trim()) return true;
  if (s.type === "solution" && !s.body.trim() && s.items.length === 0) return true;
  const min = MIN_ITEMS[s.type];
  return min !== undefined && s.items.filter((i) => i.title.trim()).length < min;
}
const thinCount = (secs: Section[], part: { type: SectionType }[]) => secs.slice(0, part.length).filter(isThin).length;
const score = (secs: Section[], part: { type: SectionType }[]) => Math.min(secs.length, part.length) * 10 - thinCount(secs, part);

/**
 * 기획 초안의 섹션 일부(from~to)를 생성. 클라이언트가 여러 묶음을 병렬로 요청해 합친다.
 * (서버리스 요청 시간 제한 안에서 끝나고, 사용자 대기 시간도 줄어듦)
 */
export async function POST(req: Request) {
  const { images, input, plan, brandColor, token, from = 0, to } = (await req.json()) as {
    images: string[];
    input: ProductInput;
    plan: Plan;
    brandColor?: string;
    token: string;
    from?: number;
    to?: number;
  };
  return handle(async () => {
    const { user } = await requireUser();
    requireAI();
    if (isDemoMode()) {
      await demoDelay(1800);
      const page = demoPage(input, images.length);
      if (brandColor) page.theme.primary = brandColor;
      return { ...page, demo: true };
    }
    verifyGenToken(token, user.id);
    const end = Math.min(to ?? plan.sections.length, plan.sections.length);
    const part = plan.sections.slice(from, end);
    const run = () => callStructured({
      system: GENERATE_SYSTEM,
      schema: PageSchema,
      effort: "medium",
      maxTokens: 20000,
      content: [
        ...imageBlocks(images),
        {
          type: "text",
          text: [
            `[상품 정보]\n${inputToText(input)}`,
            `[기획 초안 전체 — 흐름 참고용]\n${planToText(plan)}`,
            `[이번에 작성할 섹션] 전체 ${plan.sections.length}개 중 ${from + 1}~${end}번 (${part.length}개):\n` +
              part.map((s, i) => `${from + i + 1}. [${s.type}] ${s.keyMessage}`).join("\n") +
              `\nsections 배열에는 정확히 ${part.length}개를 위 순서·type 그대로 넣으세요. 섹션을 합치거나 빼지 마세요. 앞뒤 섹션과 문구가 겹치지 않게 쓰세요.`,
            brandColor ? `[브랜드 메인 컬러] ${brandColor} (theme.primary 로 사용)` : "",
            `사진은 총 ${images.length}장입니다 (imageIndex 0~${images.length - 1}).`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    });
    const t0 = Date.now();
    let page = await run();
    const roomForRetry = Date.now() - t0 < 25_000; // 60초 제한 안에서만 재시도
    if (roomForRetry && (page.sections.length < part.length || thinCount(page.sections, part) > 0)) {
      // 섹션이 빠졌거나 내용이 비어 있으면 한 번 더 시도해서 더 나은 쪽을 쓴다
      const again = await run().catch(() => null);
      if (again && score(again.sections, part) > score(page.sections, part)) page = again;
    }
    // 그래도 모자라면 기획 초안의 메시지로 편집 가능한 자리를 채움
    for (let i = page.sections.length; i < part.length; i++) {
      page.sections.push({ ...emptySection(part[i].type), title: part[i].keyMessage || "제목을 입력하세요" });
    }
    const fix = (n: number) => (n >= 0 && n < images.length ? n : -1);
    page.sections = page.sections.slice(0, part.length).map((s, i) => ({
      ...s,
      type: part[i]?.type ?? s.type,
      imageIndex: fix(s.imageIndex),
      items: s.items.map((it) => ({ ...it, imageIndex: fix(it.imageIndex) })),
    }));
    return page;
  });
}
