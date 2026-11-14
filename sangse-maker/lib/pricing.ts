/** 크레딧 소모량 (기획 초안·사진 분석은 무료) */
export const COSTS = {
  analyze: 0,
  plan: 0,
  generate: 10,
  revise: 1,
  image: 5,
} as const;

export const SIGNUP_BONUS = 30;

/** 크레딧 충전 상품 — 가격은 반드시 서버에서 이 표로 결정 */
export const PACKAGES = [
  { id: "starter", name: "스타터", credits: 100, price: 9900, desc: "상세페이지 약 7개" },
  { id: "pro", name: "프로", credits: 330, price: 29000, desc: "상세페이지 약 25개 · 10% 보너스", best: true },
  { id: "biz", name: "비즈니스", credits: 1200, price: 89000, desc: "상세페이지 약 90개 · 20% 보너스" },
] as const;

export type PackageId = (typeof PACKAGES)[number]["id"];
export const findPackage = (id: string) => PACKAGES.find((p) => p.id === id);
