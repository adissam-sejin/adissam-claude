import * as z from "zod/v4";
import { SectionSchema, ThemeSchema, emptySection, type Plan, type ProductInput, type Section, type SectionType } from "@/lib/schema";
import { GENERATE_SYSTEM, inputToText, planToText } from "@/lib/prompts";
import { callStructured, imageBlocks, isDemoMode, requireAI } from "@/lib/claude";
import { demoPage } from "@/lib/demo";
import { demoDelay, handle } from "@/lib/route-helpers";
import { requireUser } from "@/lib/auth";
import { verifyGenToken } from "@/lib/gen-token";

export const maxDuration = 60;

type PlanSection = Plan["sections"][number];

/** type 별로 꼭 채워야 할 내용 (요청 문구에 섹션마다 붙임) */
const REQUIRED: Record<SectionType, string> = {
  hero: "eyebrow(영문 라벨), body(타이틀 위 부제 2줄, \\n 구분), title(짧은 상품 타이틀) 모두 필수",
  problem: "eyebrow, title(강조 1곳), items 말풍선 4개, body(마무리 안심 한 줄) 필수",
  solution: "eyebrow, title(강조 1곳), body(1~2문장) 필수",
  features: "eyebrow, title(강조 1곳), items 장점 카드 3개(extra=POINT 0N), body(한 줄 약속) 필수",
  detail: "eyebrow, title, body, items 2~3개 필수",
  howto: "eyebrow, title, items 단계 3개 필수",
  target: "eyebrow, title, items 추천 대상 4개 필수",
  comparison: "eyebrow, title, items 비교 항목 3~5개 필수",
  spec: "eyebrow, title, items 정보 4~8개 필수",
  faq: "eyebrow, title, items 질문 3~4개 필수",
  cta: "eyebrow, title(강조 1곳), body(회색 안내 박스 문구) 필수",
  notice: "eyebrow, 짧은 title, items 안내 2~4개 필수",
};

/** 섹션 type 별 최소 요건 — 비어 있는(성의 없는) 섹션을 찾아 다시 만든다 */
const MIN_ITEMS: Partial<Record<SectionType, number>> = { problem: 3, features: 2, detail: 2, howto: 2, target: 3, comparison: 2, spec: 3, faq: 2, notice: 2 };
function isThin(s: Section | undefined): boolean {
  if (!s || !s.title.trim()) return true;
  if (s.type === "solution" && !s.body.trim() && s.items.length === 0) return true;
  const min = MIN_ITEMS[s.type];
  return min !== undefined && s.items.filter((i) => i.title.trim()).length < min;
}

/**
 * 기획 초안의 섹션 일부(from~to)를 생성. 클라이언트가 여러 묶음을 병렬로 요청해 합친다.
 * (서버리스 요청 시간 제한 안에서 끝나고, 사용자 대기 시간도 줄어듦)
 * 내용이 빈 섹션은 그 섹션만 따로 다시 만들어 채운다.
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
    const t0 = Date.now();

    /** 섹션 목록(sub)을 생성. 개수를 강제하려고 배열 대신 이름 붙은 필수 칸(section_1..N)으로 받는다 */
    const run = (sub: { s: PlanSection; idx: number }[]) => {
      const ChunkSchema = z.object({
        productName: z.string(),
        theme: ThemeSchema,
        ...Object.fromEntries(sub.map((_, i) => [`section_${i + 1}`, SectionSchema])),
      });
      return callStructured({
        system: GENERATE_SYSTEM,
        schema: ChunkSchema,
        effort: "medium",
        maxTokens: 20000,
        content: [
          ...imageBlocks(images),
          {
            type: "text",
            text: [
              `[상품 정보]\n${inputToText(input)}`,
              `[기획 초안 전체 — 흐름 참고용]\n${planToText(plan)}`,
              `[이번에 작성할 섹션] 전체 ${plan.sections.length}개 중 ${sub.length}개:\n` +
                sub.map(({ s, idx }, i) => `section_${i + 1} = ${idx + 1}번 [${s.type}] 메시지: ${s.keyMessage} / ${REQUIRED[s.type]}`).join("\n") +
                `\nsection_1 ~ section_${sub.length} 을 모두 완성해서 채우세요. 빈 문자열로 남기지 마세요. 앞뒤 섹션과 문구가 겹치지 않게 쓰세요.`,
              brandColor ? `[브랜드 메인 컬러] ${brandColor} (theme.primary 로 사용)` : "",
              `사진은 총 ${images.length}장입니다 (imageIndex 0~${images.length - 1}).`,
            ]
              .filter(Boolean)
              .join("\n\n"),
          },
        ],
      }).then((out) => {
        const o = out as unknown as Record<string, Section> & { productName: string; theme: z.infer<typeof ThemeSchema> };
        return { productName: o.productName, theme: o.theme, sections: sub.map((_, i) => o[`section_${i + 1}`]) };
      });
    };

    const all = part.map((s, i) => ({ s, idx: from + i }));
    const first = await run(all);
    const sections: (Section | undefined)[] = first.sections;

    // 비어 있는 섹션만 하나씩 다시 생성 (병렬, 시간 여유가 있을 때)
    const thin = sections.map((s, i) => (isThin(s) ? i : -1)).filter((i) => i >= 0);
    if (thin.length && Date.now() - t0 < 30_000) {
      const redo = await Promise.all(thin.map((i) => run([all[i]]).catch(() => null)));
      redo.forEach((r, k) => {
        const s = r?.sections[0];
        if (s && (!isThin(s) || isThin(sections[thin[k]]))) sections[thin[k]] = s;
      });
    }

    const fix = (n: number) => (n >= 0 && n < images.length ? n : -1);
    const out: Section[] = part.map((p, i) => {
      // 그래도 없으면 기획 초안의 메시지로 편집 가능한 자리를 채움
      const s = sections[i] ?? { ...emptySection(p.type), title: p.keyMessage || "제목을 입력하세요" };
      const filled: Section = { ...s, type: p.type, title: s.title.trim() ? s.title : p.keyMessage || "제목을 입력하세요" };
      if (p.type === "hero" && !filled.body.trim()) filled.body = p.keyMessage || plan.hookCopy || "";
      return { ...filled, imageIndex: fix(filled.imageIndex), items: filled.items.map((it) => ({ ...it, imageIndex: fix(it.imageIndex) })) };
    });
    return { productName: first.productName, theme: first.theme, sections: out };
  });
}
