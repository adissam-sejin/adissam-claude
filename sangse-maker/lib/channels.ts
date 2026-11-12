import type { Theme } from "./schema";

/** 판매 채널별 상세페이지 가로 폭(px). 편집기는 860px 기준으로 그리고 내보낼 때 비율로 스케일한다. */
export const CHANNELS = [
  { id: "naver", name: "네이버 스마트스토어", width: 860 },
  { id: "coupang", name: "쿠팡", width: 780 },
  { id: "toss", name: "토스쇼핑", width: 1080 },
  { id: "gmarket", name: "G마켓", width: 860 },
  { id: "auction", name: "옥션", width: 980 },
  { id: "11st", name: "11번가", width: 800 },
] as const;

export const BASE_WIDTH = 860;

/** 스타일 템플릿: 브랜드 컬러는 유지하고 분위기(타이포/여백/장식)만 바꾼다 */
export const STYLE_PRESETS: { id: Theme["style"]; name: string; desc: string; sample: Omit<Theme, "style"> }[] = [
  { id: "clean", name: "클린", desc: "깔끔한 화이트, 생활용품·가전", sample: { primary: "#1f6feb", accent: "#e8f0fe", background: "#ffffff" } },
  { id: "premium", name: "프리미엄", desc: "다크 톤, 뷰티·고가 제품", sample: { primary: "#c9a86a", accent: "#2a2622", background: "#141210" } },
  { id: "vivid", name: "비비드", desc: "강한 컬러, 식품·키즈·트렌드", sample: { primary: "#ff5a36", accent: "#fff1ec", background: "#fffaf6" } },
  { id: "natural", name: "내추럴", desc: "베이지 톤, 리빙·유기농·패션", sample: { primary: "#6b7d4f", accent: "#efe9dc", background: "#faf7f0" } },
];
