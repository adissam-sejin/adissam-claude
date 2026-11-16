import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { api, AppError, toMessage } from './lib/api'
import type { Building, Today } from './lib/types'

type Status = 'loading' | 'signedOut' | 'needJoin' | 'ready' | 'error'

interface Ctx {
  status: Status
  session: Session | null
  me: Building | null
  today: Today | null
  isAdmin: boolean
  reload: () => Promise<void>
  toast: (msg: string) => void
  fail: (e: unknown) => void
  signOut: () => Promise<void>
}

const C = createContext<Ctx>(null as unknown as Ctx)
export const useApp = () => useContext(C)

export function AppProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [me, setMe] = useState<Building | null>(null)
  const [today, setToday] = useState<Today | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const toast = useCallback((msg: string) => {
    setToastMsg(msg)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToastMsg(null), 3200)
  }, [])
  const fail = useCallback((e: unknown) => toast(toMessage(e)), [toast])

  const load = useCallback(async (s: Session | null) => {
    if (!s) {
      setMe(null)
      setToday(null)
      setStatus('signedOut')
      return
    }
    try {
      const [b, t, role] = await Promise.all([
        api.building(s.user.id),
        api.today(),
        supabase.from('profiles').select('role').eq('id', s.user.id).maybeSingle(),
      ])
      setMe(b)
      setToday(t)
      setIsAdmin(role.data?.role === 'admin')
      setStatus('ready')
    } catch (e) {
      if (e instanceof AppError && e.code === 'NOT_MEMBER') setStatus('needJoin')
      else setStatus('error')
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      void load(data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setSession(s)
        // 인증 콜백 안에서 바로 다른 요청을 보내면 멈출 수 있어 한 박자 늦춘다.
        setTimeout(() => void load(s), 0)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [load])

  const reload = useCallback(() => load(session), [load, session])
  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <C.Provider value={{ status, session, me, today, isAdmin, reload, toast, fail, signOut }}>
      {children}
      {toastMsg && (
        <div className="toast" role="status" aria-live="polite">
          {toastMsg}
        </div>
      )}
    </C.Provider>
  )
}

// 버튼 동작을 감싸서: 진행 중 표시 + 실패하면 알기 쉬운 말로 알려준다.
export function useRun() {
  const { fail } = useApp()
  const [busy, setBusy] = useState(false)
  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true)
      try {
        await fn()
      } catch (e) {
        fail(e)
      } finally {
        setBusy(false)
      }
    },
    [fail],
  )
  return [busy, run] as const
}
