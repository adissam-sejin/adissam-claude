import { supabase } from './supabase'
import type { Building, Today, Town } from './types'

// 서버가 돌려주는 짧은 부호를 "무엇이 문제인지 + 다음에 무엇을 하면 되는지"로 바꾼다.
const MESSAGES: Record<string, string> = {
  NOT_SIGNED_IN: '로그인이 풀렸어요. 처음 화면에서 다시 시작해 주세요.',
  NOT_MEMBER: '아직 건물이 없어요. 처음 화면에서 다시 시작해 주세요.',
  NOT_ADMIN: '관리자만 할 수 있는 일이에요.',
  ALREADY_JOINED: '이미 건물이 있어요. 화면을 새로 고쳐 주세요.',
  BAD_CODE: '초대 코드가 맞지 않아요. 글자를 다시 확인해 주세요.',
  BAD_URL: '주소가 올바르지 않아요. 글 주소를 처음부터 끝까지 복사해 붙여넣어 주세요.',
  DUPLICATE_URL: '이미 남긴 주소예요. 다른 글의 주소를 넣어 주세요.',
  NO_PHOTO: '사진이 올라가지 않았어요. 사진을 다시 골라 주세요.',
  DAILY_MAX: '오늘은 충분히 남기셨어요. 내일 다시 남겨 주세요.',
  NOT_YOURS: '내 것이 아니라서 바꿀 수 없어요.',
  NOT_FOR_SALE: '지금은 살 수 없는 물건이에요.',
  ALREADY_OWNED: '이미 가지고 있어요.',
  NOT_ENOUGH_STARS: '별이 조금 모자라요. 기록을 남기면 별이 모여요.',
  NOT_PLACEABLE: '이 물건은 방에 놓는 물건이 아니에요.',
  WRONG_SLOT: '이 자리에는 놓을 수 없어요. 다른 자리를 골라 주세요.',
  TOO_MANY_FLOORS: '층을 더 올릴 수 없어요.',
  NO_COURSE: '지금은 도장을 받을 수 없는 강의예요.',
  NOT_ENROLLED: '먼저 "지금 듣는 강의"로 골라 주세요.',
  BAD_SESSION: '없는 회차예요.',
  ALREADY_STAMPED: '이미 도장을 받은 회차예요.',
  NO_BOOK: '지금은 기록할 수 없는 책이에요.',
  TASTE_FULL: '취향의 방이 가득 찼어요. 몇 개를 치우고 다시 넣어 주세요.',
  SELF: '내 건물에는 응원을 보낼 수 없어요.',
  NO_USER: '찾을 수 없는 건물이에요.',
  NO_CONSENT: '회원이 소개에 동의하지 않은 소식이에요.',
  TOO_MANY: '더 넣을 수 없어요.',
  SELF_REMOVE: '내 계정은 여기서 내보낼 수 없어요. 「내 건물」 맨 아래의 [마을 떠나기]를 써 주세요.',
  LAST_ADMIN: '관리자가 한 명뿐이라 떠날 수 없어요. 마을을 돌볼 사람이 없어지기 때문이에요.',
  PLAZA_MAX: '오늘은 방명록을 충분히 남기셨어요. 내일 또 남겨 주세요.',
}

export class AppError extends Error {
  code: string
  constructor(code: string) {
    super(MESSAGES[code] ?? '잠시 문제가 생겼어요. 조금 뒤에 다시 해 주세요.')
    this.code = code
  }
}

export function toMessage(e: unknown): string {
  if (e instanceof AppError) return e.message
  return '잠시 문제가 생겼어요. 조금 뒤에 다시 해 주세요.'
}

export async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new AppError(error.message)
  return data as T
}

export const api = {
  building: (userId: string) => rpc<Building>('get_building', { p_user_id: userId }),
  publicBuilding: (key: string) => rpc<Building | null>('get_public_building', { p_key: key }),
  today: () => rpc<Today>('get_today'),
  town: () => rpc<Town>('get_town'),
}

export interface RecordResult {
  record_id: string
  stars: number
  week_count: number
  goal: number
  stamped: boolean
  bonus: number
  balance: number
}

// 사진은 올리기 전에 줄여서 보낸다 (긴 변 1280, JPEG).
export async function shrinkImage(file: File, max = 1280): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/jpeg', 0.82),
  )
}

export async function uploadPhoto(bucket: 'shared' | 'proofs', userId: string, file: File): Promise<string> {
  const blob = await shrinkImage(file)
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw new AppError('NO_PHOTO')
  return path
}

// 회원이 올린 사진 파일을 치운다. 계정을 지우기 전에 부른다. 파일이 남아도 계정 지우기는 계속한다.
export async function removeMemberFiles(userId: string): Promise<void> {
  try {
    const paths = await rpc<{ proofs: string[]; shared: string[] }>('member_photo_paths', { p_user_id: userId })
    if (paths.proofs.length) await supabase.storage.from('proofs').remove(paths.proofs)
    if (paths.shared.length) await supabase.storage.from('shared').remove(paths.shared)
  } catch { /* 파일 정리는 못 해도 넘어간다 */ }
}
