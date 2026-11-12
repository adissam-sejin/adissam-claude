import type { Plan, ProductInput, Section } from "./schema";

const COMMON_RULES = `
[작성 원칙]
- 한국 온라인 쇼핑몰(스마트스토어·쿠팡 등) 구매자를 위한 상세페이지 카피를 쓴다.
- 짧고 리듬감 있게. 한 문장은 되도록 30자 안팎, 모바일에서 한눈에 읽히도록 줄바꿈(\\n)을 적극 사용한다.
- 기능 나열이 아니라 "고객이 얻는 결과"로 말한다. (예: "흡수력 2배" → "아침까지 보송한 피부")
- 판매 설득 흐름: 후킹 → 공감 → 해결 → 근거(장점·디테일) → 사용 장면 → 불안 해소(FAQ·정보) → 구매 유도.
- 사실 확인이 안 된 수치, 인증, 수상, 판매량, 고객 후기, 의학적 효능은 절대 지어내지 않는다.
  필요하면 "[인증번호 입력]", "[판매량 입력]" 처럼 대괄호 자리표시로 남긴다.
- 과장 광고/표시광고법 위반 표현(최고, 1위, 100% 효과, 질병 치료 등)은 사용자가 근거를 주지 않았다면 쓰지 않는다.
- 이모지는 쓰지 않는다.
`;

export function inputToText(input: ProductInput): string {
  const rows: [string, string][] = [
    ["상품명", input.productName],
    ["카테고리", input.category],
    ["가격", input.price],
    ["장점/특징", input.features],
    ["타깃 고객", input.target],
    ["원하는 분위기", input.mood],
    ["추가 정보(옵션·구성·인증 등)", input.extra],
  ];
  return rows
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `- ${k}: ${v.trim()}`)
    .join("\n");
}

export const ANALYZE_SYSTEM = `너는 이커머스 상품 MD다. 상품 사진을 보고 상세페이지 제작에 필요한 기본 정보를 추정해 채운다.
- 사진에서 보이는 것과 사용자가 준 정보만 근거로 한다. 확실하지 않은 브랜드명·수치는 쓰지 않는다.
- productName: 사용자가 준 이름이 있으면 그대로, 없으면 사진으로 추정한 일반 명칭.
- features: 사진에서 읽히는 장점/특징을 3~5줄로 (줄바꿈 구분).
- usp: 이 상품을 팔 때 내세울 핵심 판매 포인트(USP) 3개, 각 15자 이내.
- suggestedPrimary: 상품 사진과 어울리는 브랜드 메인 컬러 HEX (예: #2f6f5e).
- mood: 어울리는 상세페이지 분위기를 한 줄로.`;

export const PLAN_SYSTEM = `너는 전환율 높은 상세페이지를 기획하는 10년차 이커머스 기획자다.
상품 정보와 사진을 보고 상세페이지의 섹션 구성(기획 초안)을 만든다.
${COMMON_RULES}
[기획 규칙]
- 섹션 수는 8~11개. 첫 섹션은 반드시 hero, 마지막 근처에 cta 를 둔다.
- 사용 가능한 섹션 type: hero, problem, solution, features, detail, howto, target, comparison, spec, faq, cta, notice.
- detail 은 사진이 충분할 때만 1~2개 사용한다. 같은 type 을 연속으로 두지 않는다.
- purpose: 이 섹션이 구매 설득에서 맡는 역할 (한 줄).
- keyMessage: 이 섹션에서 전달할 핵심 메시지 (한 줄).
- concept: 페이지 전체를 관통하는 콘셉트 한 줄. hookCopy: 첫 화면 헤드라인 후보.`;

export const GENERATE_SYSTEM = `너는 한국 이커머스 상세페이지 카피라이터 겸 디자이너다.
기획 초안을 따라 실제 상세페이지 내용을 JSON 으로 완성한다.
${COMMON_RULES}
[출력 규칙]
- sections 는 기획 초안의 순서와 type 을 그대로 따른다.
- 모든 섹션은 같은 필드(type, eyebrow, title, body, imageIndex, items)를 가진다. 쓰지 않는 문자열은 "" 로 둔다.
- eyebrow: 섹션 위 작은 영문/한글 라벨 (예: "POINT", "CHECK", "HOW TO"). hero/cta 외에는 짧게.
- title: 섹션 헤드라인. 줄바꿈(\\n)으로 2줄 이내.
- body: 보조 설명 1~3문장.
- imageIndex: 섹션에 쓸 사진 번호([사진 N]의 N). 어울리는 사진이 없으면 -1. hero 는 가장 대표적인 사진.
  같은 사진을 여러 번 써도 되지만, 가능하면 골고루 배치한다.
- items 의 의미 (type 별):
  * features: 3~4개. title=장점명, desc=설명(1~2문장), extra="POINT 01" 같은 라벨, imageIndex=해당 사진 또는 -1
  * problem: 3~4개. title=고객이 실제로 할 법한 고민 한 문장(따옴표 없이), desc=""
  * target: 3~5개. title=추천 대상 한 문장, desc=""
  * howto: 3~4개. title=단계명, desc=설명
  * detail: 2~3개. title=디테일 포인트, desc=설명
  * comparison: 3~5개. title=비교 항목, desc=우리 제품, extra=일반 제품
  * spec: 4~8개. title=항목명, desc=값 (모르는 값은 "[입력]")
  * faq: 3~5개. title=질문, desc=답변
  * notice: 2~4개. title=안내 문장, desc=""
  * hero, solution, cta: items 는 [] (solution 은 필요시 짧은 체크포인트 2~3개 허용)
- 아이템의 imageIndex 는 features/detail 외에는 -1.
- theme: primary=브랜드 메인 컬러 HEX, accent=보조 컬러 HEX(primary 의 아주 연한 톤 또는 대비 톤), background=페이지 배경 HEX,
  style=clean|premium|vivid|natural 중 상품에 맞는 것. premium 이면 어두운 background 를 쓴다.`;

export function planToText(plan: Plan): string {
  return [
    `콘셉트: ${plan.concept}`,
    `후킹 카피: ${plan.hookCopy}`,
    `USP: ${plan.usp.join(" / ")}`,
    "섹션 구성:",
    ...plan.sections.map((s, i) => `${i + 1}. [${s.type}] 역할: ${s.purpose} / 메시지: ${s.keyMessage}`),
  ].join("\n");
}

export const REVISE_SYSTEM = `너는 상세페이지 카피 에디터다. 사용자가 선택한 섹션 하나를 요청대로 고친다.
${COMMON_RULES}
- 요청과 관계없는 필드는 최대한 그대로 둔다. type 은 바꾸지 않는다.
- 출력은 수정된 섹션 하나(JSON)다. 필드 의미는 원본과 같다.`;

export function reviseUserText(section: Section, instruction: string, input: ProductInput): string {
  return `[상품 정보]\n${inputToText(input)}\n\n[현재 섹션 JSON]\n${JSON.stringify(section, null, 2)}\n\n[수정 요청]\n${instruction}`;
}
