import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../ctx'
import { api } from '../lib/api'
import type { Town } from '../lib/types'
import { MiniBuilding } from '../components/Building'
import { Loading } from '../components/ui'
import { fmtDay, newsInfo, seeded } from '../lib/util'

// 우리 마을 지도: 모든 건물이 한 거리에 선다. 순위도, 뒤로 밀리는 건물도 없다.
export default function TownPage() {
  const { fail } = useApp()
  const nav = useNavigate()
  const [town, setTown] = useState<Town | null>(null)

  useEffect(() => {
    api.town().then(setTown).catch(fail)
  }, [fail])
  if (!town) return <Loading text="마을을 불러오는 중이에요" />

  const trees = seeded('town-trees', 24)
  const go = (id: string) => nav(id === town.me ? '/building' : `/visit/${id}`)

  return (
    <div className="stack">
      <div className="map">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="map-tree" aria-hidden style={{ left: `${trees[i * 3] * 92}%`, top: `${12 + trees[i * 3 + 1] * 84}%` }}>
            {['🌳', '🌲', '🌼', '🌳'][i % 4]}
          </span>
        ))}
        <div className="map-plaza">
          <h2>우리 마을 광장</h2>
          <p>이번 주 우리 마을 기록 <b>{town.week_total}개</b> · 건물 {town.buildings.length}채</p>
        </div>
        <div className="map-street">
          {town.buildings.map((t) => (
            <button key={t.id} className={`plot${t.id === town.me ? ' me' : ''}`} onClick={() => go(t.id)}
              aria-label={`${t.brand_name || t.nickname} 건물${t.id === town.me ? ' (내 건물)' : ''} 가 보기`}>
              <MiniBuilding t={t} />
              <span className="plot-name">{t.id === town.me ? '내 건물' : (t.brand_name || t.nickname)}</span>
              <span className="plot-state">{t.week_count > 0 ? `이번 주 ${t.week_count}개째 만드는 중` : '이번 주 준비 중'}</span>
            </button>
          ))}
        </div>
      </div>
      <section className="card stack">
        <h2>광장 소식판</h2>
        {town.news.length === 0 ? <p className="empty">아직 올라온 소식이 없어요. 좋은 일이 생기면 1층 로비에서 알려 주세요.</p> : (
          <ul className="list">
            {town.news.map((n) => (
              <li key={n.id}>
                <span className="ico" aria-hidden>{newsInfo(n.kind).emoji}</span>
                <span className="txt"><b>{n.nickname}님 · {newsInfo(n.kind).banner} · {fmtDay(n.created_at)}{n.featured ? ' · 🎀' : ''}</b>{n.note}</span>
                <button className="btn small" onClick={() => go(n.user_id)}>축하하러 가기</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
