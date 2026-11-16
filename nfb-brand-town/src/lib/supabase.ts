import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

export const configured = Boolean(url && key)

// 브라우저에는 공개용(publishable) 키만 들어간다. 비밀 키는 어디에도 넣지 않는다.
export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

// 이메일 로그인은 내 컴퓨터에서 돌려 볼 때(npm run dev)만 켜진다. 올라간 사이트에서는 항상 꺼져 있다.
export const devLogin = import.meta.env.DEV && import.meta.env.VITE_DEV_LOGIN === '1'

export function sharedUrl(path: string | null | undefined): string | null {
  if (!path) return null
  // 사이트에 함께 올린 그림(/art/...)이나 바깥 주소는 그대로 쓴다.
  if (path.startsWith('/') || /^https?:\/\//.test(path)) return path
  return supabase.storage.from('shared').getPublicUrl(path).data.publicUrl
}
