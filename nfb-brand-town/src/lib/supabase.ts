import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

export const configured = Boolean(url && key)

// 브라우저에는 공개용(publishable) 키만 들어간다. 비밀 키는 어디에도 넣지 않는다.
export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export const devLogin = import.meta.env.VITE_DEV_LOGIN === '1'

export function sharedUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  return supabase.storage.from('shared').getPublicUrl(path).data.publicUrl
}
