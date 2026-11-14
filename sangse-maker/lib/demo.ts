import type { Analysis, Page, Plan, ProductInput, Section } from "./schema";

/** API 키 없이도 화면 흐름을 체험할 수 있도록 하는 샘플 응답 */

export function demoAnalysis(input: Partial<ProductInput>): Analysis {
  return {
    productName: input.productName || "데일리 텀블러 500ml",
    category: input.category || "주방/생활용품",
    features: "이중 진공 구조로 보온·보냉 유지\n한 손으로 여는 원터치 뚜껑\n컵홀더에 쏙 들어가는 슬림 바디\n세척이 쉬운 넓은 입구",
    target: "출퇴근길에 커피를 들고 다니는 직장인",
    mood: "깔끔하고 산뜻한 데일리 무드",
    usp: ["하루 종일 그 온도", "한 손 원터치", "가방 속 새지 않음"],
    suggestedPrimary: "#2f6f5e",
  };
}

export function demoPlan(input: ProductInput): Plan {
  const name = input.productName || "데일리 텀블러";
  return {
    concept: `아침의 온도를 퇴근까지, ${name}`,
    hookCopy: "아침에 담은 커피,\n퇴근길에도 따뜻하게",
    usp: ["하루 종일 그 온도", "한 손 원터치", "가방 속 새지 않음"],
    sections: [
      { type: "hero", purpose: "3초 안에 시선을 잡는다", keyMessage: "하루 종일 유지되는 온도" },
      { type: "problem", purpose: "고객의 불편에 공감한다", keyMessage: "금방 식고, 새고, 무겁다" },
      { type: "solution", purpose: "이 상품이 답임을 제시한다", keyMessage: "작은 텀블러 하나로 해결" },
      { type: "features", purpose: "핵심 장점 3가지를 근거와 함께", keyMessage: "보온·원터치·밀폐" },
      { type: "detail", purpose: "디테일로 품질을 보여준다", keyMessage: "손이 닿는 곳까지 꼼꼼하게" },
      { type: "howto", purpose: "사용 장면을 그리게 한다", keyMessage: "담고, 닫고, 들고 나가기" },
      { type: "target", purpose: "내 얘기라고 느끼게 한다", keyMessage: "이런 분께 추천" },
      { type: "comparison", purpose: "선택 이유를 정리한다", keyMessage: "일반 텀블러와 비교" },
      { type: "spec", purpose: "구매 전 정보를 확인시킨다", keyMessage: "상품 정보" },
      { type: "faq", purpose: "마지막 불안을 해소한다", keyMessage: "자주 묻는 질문" },
      { type: "cta", purpose: "구매를 결정하게 한다", keyMessage: "오늘부터 따뜻하게" },
    ],
  };
}

const it = (title: string, desc = "", extra = "", imageIndex = -1) => ({ title, desc, extra, imageIndex });

export function demoPage(input: ProductInput, imageCount: number): Page {
  const name = input.productName || "데일리 텀블러 500ml";
  const img = (i: number) => (imageCount > 0 ? i % imageCount : -1);
  const sections: Section[] = [
    { type: "hero", eyebrow: "DAILY TUMBLER", title: "하루 종일\n그 온도", body: `아침에 담은 커피,\n퇴근길에도 따뜻하게`, imageIndex: img(0), items: [it("이중 진공 보온·보냉"), it("한 손 원터치")] },
    { type: "problem", eyebrow: "혹시 이런 경험 있으신가요?", title: "텀블러, 들고 다니는데\n**왜** 금방 식을까요?", body: "이제 그런 걱정은 넣어두세요!", imageIndex: -1, items: [it("점심 전에 커피가 미지근해져요"), it("가방 속에서 새서 깜짝 놀랐어요"), it("뚜껑 열 때마다 두 손이 필요해요"), it("예쁜 텀블러는 왜 다 무거울까요?")] },
    { type: "solution", eyebrow: "그래서 만들었어요", title: "처음부터 다시\n**설계**했습니다", body: "온도, 밀폐, 사용감. 매일 쓰는 물건이 갖춰야 할 세 가지를 한 번에 담았어요.", imageIndex: img(1), items: [] },
    { type: "features", eyebrow: "핵심 포인트", title: "매일 쓰고 싶어지는\n**3가지** 이유", body: "이중 진공 · 원터치 · 이중 밀폐, 하나로 끝", imageIndex: -1, items: [it("하루 종일 그 온도", "이중 진공 구조가 바깥 공기를 막아 따뜻함도 차가움도 오래 지켜요. [보온 시간 입력]", "POINT 01", img(0)), it("한 손으로 원터치", "버튼 하나로 열리고 닫혀요. 운전 중에도, 지하철에서도 편하게.", "POINT 02", img(1)), it("가방에 넣어도 안심", "실리콘 패킹이 꼼꼼하게 밀폐해 거꾸로 들어도 새지 않아요.", "POINT 03", img(2))] },
    { type: "detail", eyebrow: "디테일", title: "손이 닿는 곳까지\n**꼼꼼하게**", body: "", imageIndex: img(2), items: [it("넓은 입구", "얼음도 쏙, 세척 솔도 쏙 들어가요."), it("슬림 바디", "차량 컵홀더에 딱 맞는 지름이에요."), it("미끄럼 방지 바닥", "책상 위에서도 안정적으로 서 있어요.")] },
    { type: "howto", eyebrow: "이렇게 써요", title: "담고, 닫고,\n**들고** 나가면 끝", body: "", imageIndex: -1, items: [it("담기", "좋아하는 음료를 80%까지 채워 주세요."), it("닫기", "딸깍 소리가 날 때까지 뚜껑을 눌러 주세요."), it("마시기", "버튼을 눌러 한 손으로 편하게 마셔요.")] },
    { type: "target", eyebrow: "이런 분께 추천해요", title: "매일 아침\n**커피**와 함께라면", body: "", imageIndex: -1, items: [it("매일 아침 커피를 들고 출근하는 분"), it("일회용 컵 사용을 줄이고 싶은 분"), it("운전 중에도 음료를 자주 마시는 분"), it("가볍고 새지 않는 텀블러를 찾던 분")] },
    { type: "comparison", eyebrow: "비교해 보세요", title: "나란히 놓고 보면\n**차이**가 보여요", body: "", imageIndex: -1, items: [it("보온 구조", "이중 진공", "단일 벽"), it("여는 방식", "한 손 원터치", "돌려 여는 뚜껑"), it("밀폐", "실리콘 이중 패킹", "단일 패킹"), it("세척", "넓은 입구", "좁은 입구")] },
    { type: "spec", eyebrow: "상품 정보", title: "구매 전\n**꼭** 확인하세요", body: "", imageIndex: -1, items: [it("제품명", name), it("용량", "[용량 입력]"), it("소재", "[소재 입력]"), it("크기", "[크기 입력]"), it("제조국", "[제조국 입력]")] },
    { type: "faq", eyebrow: "자주 묻는 질문", title: "궁금한 점,\n**미리** 답해드려요", body: "", imageIndex: -1, items: [it("식기세척기에 넣어도 되나요?", "본체는 손세척을 권장해요. 뚜껑 분리 세척 여부는 [안내 입력]."), it("탄산음료를 담아도 되나요?", "내부 압력이 높아질 수 있어 탄산음료는 권장하지 않아요."), it("뜨거운 물을 담아도 되나요?", "네, 뜨거운 음료도 안전하게 담을 수 있어요. 처음 열 때는 김에 주의해 주세요.")] },
    { type: "cta", eyebrow: "오늘부터 따뜻하게", title: "내일 아침부터,\n**따뜻한** 하루를", body: "지금 원하는 컬러를 골라 주문해 보세요", imageIndex: img(0), items: [] },
  ];
  return {
    productName: name,
    theme: { primary: "#14907F", accent: "#e3f3ef", background: "#f7f4ef", style: "signature" },
    sections,
  };
}
