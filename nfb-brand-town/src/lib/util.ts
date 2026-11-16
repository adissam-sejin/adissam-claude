import type { ChannelType, Floor, FloorKind, NewsKind } from './types'

export const CHANNELS: { type: ChannelType; name: string; emoji: string; room: string }[] = [
  { type: 'blog', name: '블로그', emoji: '✍️', room: '글 쓰는 서재' },
  { type: 'instagram', name: '인스타그램', emoji: '📷', room: '사진관' },
  { type: 'youtube', name: '유튜브', emoji: '🎬', room: '촬영실' },
  { type: 'threads', name: '스레드', emoji: '💬', room: '사랑방' },
  { type: 'etc', name: '그 밖', emoji: '🌟', room: '작업실' },
]

export const channelInfo = (t: ChannelType | null) => CHANNELS.find((c) => c.type === t) ?? CHANNELS[4]

// 주소만 붙여넣어도 어느 채널인지 알아챈다.
export function guessChannel(url: string): ChannelType | null {
  const u = url.toLowerCase()
  if (/blog\.naver\.com|m\.blog\.naver|tistory\.com|brunch\.co\.kr|velog\.io|medium\.com/.test(u)) return 'blog'
  if (/instagram\.com/.test(u)) return 'instagram'
  if (/youtube\.com|youtu\.be/.test(u)) return 'youtube'
  if (/threads\.(net|com)/.test(u)) return 'threads'
  return null
}

export const FLOOR_NAMES: Record<FloorKind, string> = {
  lobby: '로비',
  classroom: '강의실',
  library: '서재',
  sns: '작업실',
  rooftop: '옥상',
}

export function floorTitle(f: Floor): string {
  if (f.kind === 'sns') return f.channel_name || channelInfo(f.channel_type).name
  return FLOOR_NAMES[f.kind]
}

// 1층 로비, 2층 강의실, 3층 서재, 4층부터 채널 층
export function floorNumber(floors: Floor[], f: Floor): string {
  if (f.kind === 'rooftop') return '옥상'
  const order = floors.filter((x) => x.kind !== 'rooftop').sort((a, b) => a.position - b.position)
  return `${order.findIndex((x) => x.id === f.id) + 1}층`
}

export const NEWS_KINDS: { kind: NewsKind; label: string; banner: string; emoji: string }[] = [
  { kind: 'first_lecture', label: '처음으로 강의를 했어요', banner: '첫 강의 데뷔', emoji: '🎤' },
  { kind: 'book', label: '책을 냈어요', banner: '책 출간', emoji: '📕' },
  { kind: 'press', label: '기사·인터뷰에 나왔어요', banner: '기사에 실림', emoji: '📰' },
  { kind: 'income', label: '첫 수익이 생겼어요', banner: '첫 수익', emoji: '💰' },
  { kind: 'collab', label: '함께 하자는 제안을 받았어요', banner: '협업 제안', emoji: '🤝' },
  { kind: 'award', label: '상을 받았어요', banner: '수상', emoji: '🏆' },
  { kind: 'etc', label: '그 밖의 좋은 소식', banner: '좋은 소식', emoji: '🎉' },
]
export const newsInfo = (k: NewsKind) => NEWS_KINDS.find((n) => n.kind === k) ?? NEWS_KINDS[6]

export const BOOK_STAGES: { stage: string; label: string }[] = [
  { stage: 'plan', label: '기획' },
  { stage: 'toc', label: '목차' },
  { stage: 'draft', label: '원고' },
  { stage: 'cover', label: '표지' },
  { stage: 'published', label: '출간' },
]

export const BRAND_COLORS: { name: string; hex: string }[] = [
  { name: '딥레드', hex: '#B5403A' },
  { name: '코랄', hex: '#E0705A' },
  { name: '주황', hex: '#E08A2E' },
  { name: '겨자', hex: '#C9A227' },
  { name: '올리브', hex: '#7A8B3A' },
  { name: '초록', hex: '#2F7D5B' },
  { name: '청록', hex: '#14907F' },
  { name: '하늘', hex: '#3E8FC2' },
  { name: '남색', hex: '#2F4A8F' },
  { name: '보라', hex: '#6B4FA0' },
  { name: '자주', hex: '#A0457E' },
  { name: '갈색', hex: '#7A5236' },
  { name: '먹색', hex: '#3F3F46' },
]

// 날짜만 있는 값('2026-11-17')은 그대로, 시각이 붙은 값은 한국 시간으로 바꿔 읽는다.
function ymd(d: string): [number, number, number] {
  if (d.length > 10) {
    const k = new Date(new Date(d).getTime() + 9 * 3600 * 1000)
    return [k.getUTCFullYear(), k.getUTCMonth() + 1, k.getUTCDate()]
  }
  const [y, m, day] = d.split('-').map(Number)
  return [y, m, day]
}

export function fmtDay(d: string): string {
  const [, m, day] = ymd(d)
  return `${m}월 ${day}일`
}

export function fmtFullDay(d: string | null): string {
  if (!d) return ''
  const [y, m, day] = ymd(d)
  return `${y}년 ${m}월 ${day}일`
}

// 같은 입력에는 늘 같은 값이 나오는 간단한 난수 (별·책등 자리 잡기용)
export function seeded(seed: string, n: number): number[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    out.push(((h >>> 0) % 10000) / 10000)
  }
  return out
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + amt * 255)))
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

// 받침에 따라 조사를 고른다: josa('액자', '을', '를') → '액자를'
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  const code = word.charCodeAt(word.length - 1)
  if (code < 0xac00 || code > 0xd7a3) return `${word}${withoutFinal}`
  return `${word}${(code - 0xac00) % 28 === 0 ? withoutFinal : withFinal}`
}
