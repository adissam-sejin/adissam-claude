/** 원고지 칸 배치: 각 글자 index → 칸 번호, 줄바꿈은 다음 줄 첫 칸으로 */
export function wongojiLayout(text: string, cols: number) {
  const pos: number[] = [];
  const cells: (string | null)[] = [];
  let cur = 0;
  for (const ch of Array.from(text)) {
    pos.push(cur);
    if (ch === "\n") {
      const next = (Math.floor(cur / cols) + 1) * cols;
      while (cells.length < next) cells.push(null);
      cur = next;
    } else {
      cells[cur] = ch;
      cur++;
    }
  }
  pos.push(cur);
  return { pos, cells, end: cur };
}
