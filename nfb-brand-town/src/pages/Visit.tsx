import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useApp, useRun } from '../ctx'
import { api, rpc } from '../lib/api'
import type { Building } from '../lib/types'
import { BuildingView } from '../components/Building'
import { BuildingInfo } from '../components/BuildingInfo'
import { Celebrate, Loading } from '../components/ui'

export default function Visit() {
  const { id } = useParams()
  const { session, reload, fail } = useApp()
  const nav = useNavigate()
  const [b, setB] = useState<Building | null>(null)
  const [busy, run] = useRun()
  const [sent, setSent] = useState<number | null>(null)

  const load = useCallback(() => api.building(id!).then(setB).catch(fail), [id, fail])
  useEffect(() => { void load() }, [load])

  if (id === session?.user.id) return <Navigate to="/building" replace />
  if (!b) return <Loading />
  const p = b.profile
  const banner = b.news.find((n) => n.on_banner)

  const cheer = () =>
    run(async () => {
      const r = await rpc<{ sent: boolean; stars: number }>('cheer', { p_to_user: p.id, p_news_id: banner?.id ?? null })
      await Promise.all([load(), reload()])
      setSent(r.stars)
    })

  return (
    <div className="split">
      <div className="sticky stack">
        <button className="backlink" onClick={() => nav('/town')}>← 우리 마을로</button>
        <BuildingView b={b} />
      </div>
      <div className="stack">
        <section className="card stack">
          <h1>{p.brand_name || `${p.nickname}님의 건물`}</h1>
          <p className="muted">{p.nickname}님{p.tagline ? ` · ${p.tagline}` : ''}</p>
          <div className="kv">
            <span>도장 {b.stamps}개</span>
            <span>기록 {b.records}개</span>
            <span>받은 응원 {b.cheers}번</span>
          </div>
          <p>{b.week.count > 0 ? `이번 주 ${b.week.count}개째 만드는 중이에요.` : '이번 주를 준비하고 있어요.'}</p>
          {b.cheered_today ? (
            <p className="empty">오늘 응원을 보냈어요. 내일 또 보낼 수 있어요.</p>
          ) : (
            <button className="btn primary big" disabled={busy} onClick={cheer}>{banner ? '축하 꽃 보내기' : '응원 보내기'}</button>
          )}
        </section>
        <BuildingInfo b={b} />
      </div>
      {sent !== null && (
        <Celebrate icon="💐" title={`${p.nickname}님에게 응원을 보냈어요`} lines={[sent > 0 ? `오늘 첫 응원이라 별 ${sent}개를 받았어요.` : '따뜻한 마음이 전해졌어요.']} onDone={() => setSent(null)} />
      )}
    </div>
  )
}
