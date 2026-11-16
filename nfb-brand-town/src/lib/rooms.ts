import type { ChannelType, FloorKind, Taste } from './types'

// 방 그림 한 장마다, 물건을 놓는 자리와 그림 위에 얹는 것(책·쪽지·도장·간판 글자)의 위치를 적어 둔다.
// 숫자는 모두 방 그림 크기에 대한 퍼센트(%)다.
export type RoomArt = 'lobby' | 'classroom' | 'library' | 'blog' | 'instagram' | 'youtube' | 'threads' | 'etc' | 'rooftop'

export function roomArt(f: { kind: FloorKind; channel_type: ChannelType | null }): RoomArt {
  if (f.kind === 'sns') return f.channel_type ?? 'etc'
  return f.kind
}

export interface RoomLayout {
  ratio: number                 // 그림의 가로 ÷ 세로
  floor: number[]               // 바닥 자리: 가운데 x
  floorY: number                // 물건이 서는 높이: 아래에서부터
  wall: [number, number][]      // 벽 자리: 가운데 x, 가운데 y
  board?: [number, number, number, number]   // 기록 판(x, y, 폭, 높이)
  plank?: [number, number, number]           // 스크랩북 선반(x, 윗면 y, 폭)
  chalk?: [number, number, number, number]   // 칠판
  shelves?: [number, number, number][]       // 책장 칸(x, 바닥 y, 폭)
  tinted?: boolean              // 브랜드 색으로 칠하는 부분이 있는 그림
  scale?: number                // 그림이 낮은 방(옥상)에서 물건 키를 맞추는 값
}

const SNS_FLOOR = [8, 21, 34, 47]

export const ROOMS: Record<RoomArt, RoomLayout> = {
  lobby: { ratio: 2.5, floor: [36.5, 63.5], floorY: 4, wall: [], tinted: true },
  classroom: { ratio: 2.5, floor: [10, 30, 50, 70, 90], floorY: 7, wall: [[14, 40], [83, 46]], chalk: [30.5, 18, 39, 39] },
  library: { ratio: 2.5, floor: [10, 30, 50, 70, 90], floorY: 7, wall: [[66, 42], [82, 46]], shelves: [[7, 37.5, 44.5], [7, 67.5, 44.5]] },
  blog: { ratio: 2.5, floor: SNS_FLOOR, floorY: 6, wall: [[48.5, 56]], board: [8, 15, 28.5, 36.5], plank: [41.5, 28.5, 14.5] },
  instagram: { ratio: 2.5, floor: SNS_FLOOR, floorY: 6, wall: [[46, 56]], board: [8, 14, 26.5, 38.5], plank: [40, 28, 12] },
  youtube: { ratio: 2.5, floor: SNS_FLOOR, floorY: 6, wall: [[43.5, 57]], board: [5, 14.5, 27.5, 41.5], plank: [37.5, 30, 12] },
  threads: { ratio: 2.5, floor: SNS_FLOOR, floorY: 6, wall: [[49.5, 60]], board: [6, 15, 32, 40.5], plank: [43.5, 34, 13] },
  etc: { ratio: 2.5, floor: SNS_FLOOR, floorY: 6, wall: [[49.5, 56]], board: [5.5, 14, 31, 41.5], plank: [42.5, 28.5, 14] },
  rooftop: { ratio: 1440 / 411, floor: [12, 28, 44, 60, 76], floorY: 11, wall: [], tinted: true, scale: 1.4 },
}

// 로비 그림 안의 자리들
export const LOBBY = {
  sign: [40.5, 6.5, 19, 14] as const,            // 간판 글자(x, y, 폭, 높이)
  windowBooks: [12, 68, 17] as const,            // 쇼윈도 책(x, 바닥 y, 폭)
  cubbies: [[68.6, 53.5, 11.8], [82.2, 53.5, 11.8], [68.6, 78, 11.8], [82.2, 78, 11.8]] as const, // 취향 칸(x, 바닥 y, 폭)
}

export const slotKeys = (art: RoomArt) => [
  ...ROOMS[art].floor.map((_, i) => `f${i + 1}`),
  ...ROOMS[art].wall.map((_, i) => `w${i + 1}`),
]

export const artUrl = (path: string) => `/art/${path}`
export const roomUrl = (art: RoomArt, small = false) => artUrl(`rooms/${small ? 'sm/' : ''}${art}.webp`)
export const maskUrl = (art: RoomArt, small = false) => artUrl(`rooms/${small ? 'sm/' : ''}${art}_mask.webp`)

// 취향 물건: 고른 이름 → 그림
const TASTE_ART: Record<string, string> = {
  커피: 'coffee', 차: 'tea', 빵: 'bread', 케이크: 'cake', 요리: 'cooking', 국수: 'noodles', 찌개: 'stew', 와인: 'wine', 딸기: 'strawberry',
  귤: 'mandarin', 고양이: 'cat', 강아지: 'dog', 새: 'bird', 나비: 'butterfly', 꽃: 'flower', 해바라기: 'sunflower', '식물 키우기': 'sprout', 바다: 'sea',
  산: 'mountain', 봄: 'spring', 가을: 'autumn', '눈 오는 날': 'snow', '비 오는 날': 'rain', '밤 산책': 'nightwalk', '아침 햇살': 'morning', 등산: 'hiking', 자전거: 'bicycle',
  요가: 'yoga', 수영: 'swimming', 골프: 'golf', 춤: 'dance', 캠핑: 'camping', 여행: 'travel', 낚시: 'fishing', 축구: 'soccer', 야구: 'baseball',
  '책 읽기': 'reading', 영화: 'movie', 드라마: 'drama', 음악: 'music', '노래 부르기': 'singing', 라디오: 'radio', 공연: 'theater', 미술관: 'museum', '사진 찍기': 'photo',
  글쓰기: 'writing', 손글씨: 'handwriting', '그림 그리기': 'painting', 뜨개질: 'knitting', 바느질: 'sewing', 도자기: 'pottery', 피아노: 'piano', 기타: 'guitar', 향초: 'candle',
  퍼즐: 'puzzle', 인공지능: 'robot', '집 꾸미기': 'home',
}

export function tasteArt(t: Pick<Taste, 'kind' | 'shape' | 'label'>): string | null {
  if (t.kind === 'pick') return TASTE_ART[t.label] ? artUrl(`taste/${TASTE_ART[t.label]}.webp`) : null
  if (t.shape === 'book') return artUrl('taste/book.webp')
  if (t.shape === 'record') return artUrl('taste/record.webp')
  if (t.shape === 'note') return artUrl('taste/letter.webp')
  return null
}
export const tasteArtByLabel = (label: string) => (TASTE_ART[label] ? artUrl(`taste/${TASTE_ART[label]}.webp`) : null)
