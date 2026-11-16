import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../ctx'
import { api } from '../lib/api'
import type { Town, TownBuilding } from '../lib/types'
import { MiniBuilding } from '../components/Building'
import { Loading } from '../components/ui'
import { artUrl } from '../lib/rooms'
import { fmtDay, newsInfo, seeded } from '../lib/util'

const prop = (name: string) => artUrl(`town/${name}.webp`)
const YARD = ['tree_round', 'bush', 'tree_cherry', 'flowerbed', 'tree_pine', 'lamp', 'mailbox', 'rock', 'bicycle', 'bench']
const LANDMARKS = ['pond', 'gazebo', 'stall', 'well', 'bridge']

// 우리 마을 지도: 구불구불한 길을 따라 모든 건물이 선다. 순위도, 뒤로 밀리는 건물도 없다.
export default function TownPage() {
  const { fail } = useApp()
  const nav = useNavigate()
  const [town, setTown] = useState<Town | null>(null)
  const newsRef = useRef<HTMLElement>(null)

  useEffect(() => {
    api.town().then(setTown).catch(fail)
  }, [fail])
  if (!town) return <Loading text="마을을 불러오는 중이에요" />

  const go = (id: string) => nav(id === town.me ? '/building' : `/visit/${id}`)
  // 넓은 화면에서는 길이 두 갈래로 나뉜다.
  const lanes: TownBuilding[][] = [[], []]
  town.buildings.forEach((b, i) => lanes[i % 2].push(b))

  return (
    <div className="stack">
      <div className="town">
        <div className="fireflies" aria-hidden>{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 97}%`, top: `${(i * 53) % 93}%`, animationDelay: `${(i * 0.7) % 5}s` }} />)}</div>
        <div className="plaza">
          <img className="p-tree l" src={prop('tree_cherry')} alt="" />
          <img className="p-lamp l" src={prop('lamp')} alt="" />
          <img className="p-bench" src={prop('bench')} alt="" />
          <img className="p-fountain" src={prop('fountain')} alt="" />
          <button className="p-board" onClick={() => newsRef.current?.scrollIntoView({ behavior: 'smooth' })} aria-label="광장 소식판 보기">
            <img src={prop('noticeboard')} alt="" />
            {town.news.length > 0 && <b>{town.news.length}</b>}
          </button>
          <img className="p-lamp r" src={prop('lamp')} alt="" />
          <img className="p-tree r" src={prop('tree_round')} alt="" />
          <div className="plaza-sign">
            <h2>우리 마을 광장</h2>
            <p>이번 주 기록 <b>{town.week_total}개</b> · 건물 {town.buildings.length}채</p>
          </div>
        </div>
        <div className="lanes">
          {/* 좁은 화면: 한 갈래 길 */}
          <Lane className="lane lane-one" list={town.buildings} me={town.me} go={go} />
          {/* 넓은 화면: 두 갈래 길 */}
          <Lane className="lane lane-two" list={lanes[0]} me={town.me} go={go} />
          <Lane className="lane lane-two" list={lanes[1]} me={town.me} go={go} offset={2} />
        </div>
        <div className="town-end" aria-hidden>
          <img src={prop('signpost')} alt="" />
          <img src={prop('tree_pine')} alt="" />
          <img src={prop('bush')} alt="" />
        </div>
      </div>

      <section className="card stack" ref={newsRef}>
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

function Lane({ className, list, me, go, offset = 0 }: { className: string; list: TownBuilding[]; me: string; go: (id: string) => void; offset?: number }) {
  // 건물 세 채마다 연못·정자 같은 쉼터가 길가에 하나씩 들어선다.
  const items: ({ t: TownBuilding } | { landmark: string })[] = []
  list.forEach((t, i) => {
    items.push({ t })
    if (i % 3 === 2 && i < list.length - 1) items.push({ landmark: LANDMARKS[(Math.floor(i / 3) + offset) % LANDMARKS.length] })
  })
  return (
    <div className={className}>
      {items.map((it, i) => {
        const side = i % 2 ? 'right' : 'left'
        if ('landmark' in it) {
          return (
            <div key={`l${i}`} className={`plot-wrap spot ${side}`} aria-hidden>
              <img className="landmark" src={prop(it.landmark)} alt="" />
              <img className="yard y1" src={prop('bush')} alt="" style={{ width: '22%' }} />
            </div>
          )
        }
        const t = it.t
        const r = seeded(`yard-${t.plot_no}`, 6)
        const yard = YARD[Math.floor(r[0] * YARD.length)]
        const yard2 = YARD[Math.floor(r[1] * YARD.length)]
        const far = ['tree_pine', 'tree_round', 'bush', 'tree_cherry'][Math.floor(r[5] * 4)]
        const mine = t.id === me
        return (
          <div key={t.id} className={`plot-wrap ${side}`}>
            <button className={`plot${mine ? ' me' : ''}`} onClick={() => go(t.id)}
              aria-label={`${t.brand_name || t.nickname} 건물${mine ? ' (내 건물)' : ''} 가 보기`}>
              <span className="plot-bld" style={{ '--tilt': `${(r[2] - 0.5) * 1.6}deg` } as CSSProperties}>
                <MiniBuilding t={t} />
              </span>
              <span className="plot-name">{mine ? '내 건물' : (t.brand_name || t.nickname)}</span>
              <span className="plot-state">{t.week_count > 0 ? `이번 주 ${t.week_count}개째 만드는 중` : '이번 주 준비 중'}</span>
            </button>
            <img className="yard y1" src={prop(yard)} alt="" style={{ width: `${26 + r[3] * 10}%` }} />
            {yard2 !== yard && <img className="yard y2" src={prop(yard2)} alt="" style={{ width: `${20 + r[4] * 8}%` }} />}
            <img className="yard far" src={prop(far)} alt="" style={{ width: `${30 + r[3] * 12}%`, top: `${8 + r[4] * 30}%` }} />
          </div>
        )
      })}
    </div>
  )
}
