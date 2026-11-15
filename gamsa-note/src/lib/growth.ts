import spots from "./fruitSpots.json";

export const FULL_AT = 100; // 100개까지 나무가 자라고, 101개부터 감이 열림
export const FRUIT_SPOTS = spots as { x: number; y: number }[];

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

export function fruitsOf(count: number) {
  const grown = Math.max(0, count - FULL_AT);
  return { grown, shown: Math.min(grown, FRUIT_SPOTS.length) };
}
