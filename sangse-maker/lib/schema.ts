import * as z from "zod/v4";

/** 상세페이지에서 쓰는 섹션(블록) 종류 */
export const SECTION_TYPES = [
  "hero", // 첫 화면: 후킹 헤드라인 + 대표 이미지
  "problem", // 공감: 고객의 고민/불편
  "solution", // 해결: 이 상품이 답인 이유
  "features", // 핵심 장점 카드 (USP)
  "detail", // 디테일 컷 + 설명 포인트
  "howto", // 사용 방법 단계
  "target", // 이런 분께 추천
  "comparison", // 비교표 (일반 제품 vs 우리)
  "spec", // 상품 정보 표
  "faq", // 자주 묻는 질문
  "cta", // 마무리 구매 유도
  "notice", // 배송/교환 안내
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

export const SECTION_LABELS: Record<SectionType, string> = {
  hero: "메인 후킹",
  problem: "고민 공감",
  solution: "해결 제안",
  features: "핵심 장점",
  detail: "디테일 컷",
  howto: "사용 방법",
  target: "추천 대상",
  comparison: "비교표",
  spec: "상품 정보",
  faq: "자주 묻는 질문",
  cta: "구매 유도",
  notice: "배송·교환 안내",
};

/**
 * 모든 섹션이 같은 모양을 공유한다 (구조화 출력에 안전하고, 편집기도 단순해짐).
 * - items 의 의미는 type 별로 다르다:
 *   features: title=장점명, desc=설명, extra=짧은 라벨(예: "POINT 01")
 *   problem/target/notice: title=문장, desc=보조설명(선택)
 *   howto: title=단계명, desc=설명
 *   comparison: title=비교항목, desc=우리 제품, extra=일반 제품
 *   spec: title=항목명, desc=값
 *   faq: title=질문, desc=답변
 *   detail: title=포인트, desc=설명
 */
export const ItemSchema = z.object({
  title: z.string(),
  desc: z.string(),
  extra: z.string(),
  imageIndex: z.number().int(),
});

export const SectionSchema = z.object({
  type: z.enum(SECTION_TYPES),
  eyebrow: z.string(),
  title: z.string(),
  body: z.string(),
  imageIndex: z.number().int(),
  items: z.array(ItemSchema),
});

export const ThemeSchema = z.object({
  primary: z.string(),
  accent: z.string(),
  background: z.string(),
  style: z.enum(["clean", "premium", "vivid", "natural"]),
});

export const PageSchema = z.object({
  productName: z.string(),
  theme: ThemeSchema,
  sections: z.array(SectionSchema),
});

export const AnalyzeSchema = z.object({
  productName: z.string(),
  category: z.string(),
  features: z.string(),
  target: z.string(),
  mood: z.string(),
  usp: z.array(z.string()),
  suggestedPrimary: z.string(),
});

export const PlanSchema = z.object({
  concept: z.string(),
  hookCopy: z.string(),
  usp: z.array(z.string()),
  sections: z.array(
    z.object({
      type: z.enum(SECTION_TYPES),
      purpose: z.string(),
      keyMessage: z.string(),
    }),
  ),
});

export type Item = z.infer<typeof ItemSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Analysis = z.infer<typeof AnalyzeSchema>;
export type Plan = z.infer<typeof PlanSchema>;

/** 사용자가 입력하는 상품 정보 */
export interface ProductInput {
  productName: string;
  category: string;
  price: string;
  features: string; // 장점/특징 (자유 서술)
  target: string;
  mood: string;
  extra: string; // 옵션, 구성, 인증 등 추가 정보
}

export const emptyInput: ProductInput = {
  productName: "",
  category: "",
  price: "",
  features: "",
  target: "",
  mood: "",
  extra: "",
};

export function emptySection(type: SectionType): Section {
  const base: Section = { type, eyebrow: "", title: "새 섹션 제목", body: "", imageIndex: -1, items: [] };
  const item = (title: string, desc = "", extra = ""): Item => ({ title, desc, extra, imageIndex: -1 });
  switch (type) {
    case "features":
      return { ...base, eyebrow: "WHY", items: [item("장점 1", "설명", "POINT 01"), item("장점 2", "설명", "POINT 02"), item("장점 3", "설명", "POINT 03")] };
    case "faq":
      return { ...base, title: "자주 묻는 질문", items: [item("질문을 입력하세요", "답변을 입력하세요")] };
    case "spec":
      return { ...base, title: "상품 정보", items: [item("제품명", ""), item("용량/크기", ""), item("제조국", "")] };
    case "comparison":
      return { ...base, title: "비교해 보세요", items: [item("항목", "우리 제품", "일반 제품")] };
    case "howto":
      return { ...base, title: "이렇게 사용하세요", items: [item("1단계", "설명"), item("2단계", "설명"), item("3단계", "설명")] };
    case "notice":
      return { ...base, title: "배송·교환 안내", items: [item("배송: 결제 후 1~3일 이내 출고"), item("교환/반품: 수령 후 7일 이내 가능")] };
    default:
      return base;
  }
}
