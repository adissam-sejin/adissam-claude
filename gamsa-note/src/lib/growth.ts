export const FULL_AT = 100; // 100개까지 나무가 자라고, 101개부터 감이 열림

export type Stage = { level: number; label: string; image: number };

export function stageOf(count: number): Stage {
  if (count <= 0) return { level: 0, label: "씨앗", image: 0 };
  if (count < 20) return { level: 1, label: "새싹", image: 1 };
  if (count < 45) return { level: 2, label: "떡잎", image: 2 };
  if (count < 70) return { level: 3, label: "어린 나무", image: 3 };
  if (count < FULL_AT) return { level: 4, label: "자라는 나무", image: 4 };
  if (count === FULL_AT) return { level: 5, label: "풍성한 나무", image: 5 };
  return { level: 6, label: "감나무", image: 5 };
}

const STEPS = [0, 1, 20, 45, 70, FULL_AT];

/** 레벨(Lv.1~6)과 다음 단계까지의 경험치 */
export function levelInfo(count: number) {
  const st = stageOf(count);
  const level = st.level + 1;
  if (count > FULL_AT) {
    // 감나무가 된 뒤엔 감 10개마다 한 바퀴
    const grown = count - FULL_AT;
    return { level, label: st.label, cur: grown % 10, max: 10, next: "다음 감 10개", grown };
  }
  const i = STEPS.findIndex((v) => v > count);
  const to = i === -1 ? FULL_AT + 1 : STEPS[i];
  const from = i === -1 ? FULL_AT : i === 0 ? 0 : STEPS[i - 1];
  return { level, label: st.label, cur: count - from, max: to - from, next: `다음 단계까지 ${to - count}개`, grown: 0 };
}
