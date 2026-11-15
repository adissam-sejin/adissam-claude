export const pad = (n: number) => String(n).padStart(2, "0");

export function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const today = () => ymd(new Date());

export function parseYmd(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function daysInYear(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
export function koDate(s: string) {
  const d = parseYmd(s);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`;
}
export function koShort(s: string) {
  const d = parseYmd(s);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
  return koShort(iso.slice(0, 10));
}

/** "YYYY-MM" → 해당 월 마지막 날짜 문자열 */
export function monthEnd(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return ymd(new Date(y, m, 0));
}
