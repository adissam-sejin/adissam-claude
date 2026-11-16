import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../ctx'
import { api } from '../lib/api'
import type { Town, TownBuilding } from '../lib/types'
import { Loading } from '../components/ui'
import { artUrl } from '../lib/rooms'
import { fmtDay, newsInfo, seeded, shade } from '../lib/util'

const prop = (name: string) => artUrl(`town/${name}.webp`)
// 마당 소품과 그 크기(건물 한 칸 폭에 대한 %)
const YARD: [string, number][] = [['tree_round', 30], ['bush', 20], ['tree_cherry', 30], ['flowerbed', 22], ['tree_pine', 26], ['lamp', 13], ['mailbox', 13], ['rock', 17], ['bush', 20], ['lamp', 13]]

// 하늘에서 내려다본 건물 한 채. 층수에 따라 높이가 다르고, 지붕·차양·문·깃발은 브랜드 색이다.
function Ext({ t }: { t: TownBuilding }) {
  const storeys = t.floors.filter((f) => f.kind !== 'rooftop').length
  const n = Math.max(1, Math.min(4, storeys - 3))
  const mask = `url(${prop(`ext${n}_mask`)})`
  return (
    <span className="ext" style={{ '--brand': t.brand_color, '--brand-dark': shade(t.brand_color, -0.14) } as CSSProperties}>
      <img src={prop(`ext${n}`)} alt="" draggable={false} />
      <i style={{ maskImage: mask, WebkitMaskImage: mask }} />
    </span>
  )
}

// 우리 마을 지도: 돌길로 나뉜 구획마다 건물이 모여 있다. 순위도, 뒤로 밀리는 건물도 없다.
export default function TownPage() {
  const { fail } = useApp()
  const nav = useNavigate()
  const [town, setTown] = useState<Town | null>(null)
  const [sel, setSel] = useState<TownBuilding | null>(null)
  const [finder, setFinder] = useState(false)
  const newsRef = useRef<HTMLElement>(null)

  useEffect(() => {
    api.town().then(setTown).catch(fail)
  }, [fail])
  if (!town) return <Loading text="마을을 불러오는 중이에요" />

  const go = (id: string) => nav(id === town.me ? '/building' : `/visit/${id}`)
  const nameOf = (t: TownBuilding) => (t.id === town.me ? '내 건물' : t.brand_name || t.nickname)

  // 건물 네 채가 한 구획. 구획 세 개마다 공원·장터 같은 쉼터 구획이 하나 들어간다.
  const blocks: ReactNode[] = []
  const rests = [<Park key="park" />, <Market key="market" />, <Garden key="garden" />]
  for (let i = 0, b = 0; i < town.buildings.length; i += 4, b++) {
    const group = town.buildings.slice(i, i + 4)
    blocks.push(
      <div key={`b${i}`} className="block houses">
        {group.map((t) => {
          const r = seeded(`yard-${t.plot_no}`, 4)
          const yard = YARD[Math.floor(r[0] * YARD.length)]
          const mine = t.id === town.me
          return (
            <button key={t.id} className={`lot${mine ? ' me' : ''}${sel?.id === t.id ? ' on' : ''}`} onClick={() => setSel(t)}
              aria-label={`${t.brand_name || t.nickname} 건물${mine ? ' (내 건물)' : ''}`} aria-pressed={sel?.id === t.id}>
              <Ext t={t} />
              <img className="lot-yard" src={prop(yard[0])} alt="" style={{ [r[1] > 0.5 ? 'left' : 'right']: '0%', width: `${yard[1] * (0.9 + r[2] * 0.25)}%` } as CSSProperties} />
              {t.banner && <span className="lot-flag" aria-hidden>🎉</span>}
              {mine && <span className="lot-me">내 건물</span>}
            </button>
          )
        })}
      </div>,
    )
    if (b % 3 === 1) blocks.push(<div key={`r${i}`} className="block rest" aria-hidden>{rests[Math.floor(b / 3) % rests.length]}</div>)
  }

  return (
    <div className="stack">
      <div className="vill">
        <div className="fireflies" aria-hidden>{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 97}%`, top: `${(i * 53) % 93}%`, animationDelay: `${(i * 0.7) % 5}s` }} />)}</div>
        <div className="vill-grid">
          <div className="block plaza2">
            <img className="pz-tree l" src={prop('tree_cherry')} alt="" />
            <img className="pz-tree r" src={prop('tree_round')} alt="" />
            <img className="pz-lamp l" src={prop('lamp')} alt="" />
            <img className="pz-lamp r" src={prop('lamp')} alt="" />
            <img className="pz-bench" src={prop('bench')} alt="" />
            <img className="pz-fountain" src={prop('fountain')} alt="" />
            <button className="pz-board" onClick={() => newsRef.current?.scrollIntoView({ behavior: 'smooth' })} aria-label="광장 소식판 보기">
              <img src={prop('noticeboard')} alt="" />
              {town.news.length > 0 && <b>{town.news.length}</b>}
            </button>
            <div className="plaza-sign">
              <h2>우리 마을 광장</h2>
              <p>이번 주 기록 <b>{town.week_total}개</b> · 건물 {town.buildings.length}채</p>
            </div>
          </div>
          {blocks}
        </div>
      </div>

      {sel ? (
        <section className="card stack vill-pick" aria-live="polite">
          <div className="row between">
            <h2>{nameOf(sel)}</h2>
            <button className="btn ghost small" onClick={() => setSel(null)}>닫기</button>
          </div>
          <p>{sel.id === town.me ? '' : `${sel.nickname}님 · `}{sel.week_count > 0 ? `이번 주 ${sel.week_count}개째 만드는 중이에요.` : '이번 주를 준비하고 있어요.'}{sel.banner ? ` 🎉 ${newsInfo(sel.banner.kind).banner}` : ''}</p>
          <button className="btn primary big" onClick={() => go(sel.id)}>{sel.id === town.me ? '내 건물로 가기' : '놀러 가기'}</button>
        </section>
      ) : (
        <section className="card tight">
          <p className="muted">건물을 누르면 누구의 건물인지 보여요.</p>
        </section>
      )}

      <section className="card stack">
        <div className="row between">
          <h2>이름으로 찾기</h2>
          <button className="btn small" onClick={() => setFinder((v) => !v)}>{finder ? '접기' : '펼치기'}</button>
        </div>
        {finder && (
          <div className="chips">
            {town.buildings.map((t) => (
              <button key={t.id} className="chip" onClick={() => go(t.id)}>
                <i className="dotc" style={{ background: t.brand_color }} />{nameOf(t)}
              </button>
            ))}
          </div>
        )}
      </section>

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

function Park() {
  return (
    <>
      <img src={prop('pond')} alt="" style={{ left: '22%', top: '34%', width: '56%' }} />
      <img src={prop('bridge')} alt="" style={{ left: '50%', top: '58%', width: '36%' }} />
      <img src={prop('tree_round')} alt="" style={{ left: '2%', top: '4%', width: '34%' }} />
      <img src={prop('tree_pine')} alt="" style={{ right: '4%', top: '2%', width: '28%' }} />
      <img src={prop('bench')} alt="" style={{ left: '6%', top: '70%', width: '30%' }} />
      <img src={prop('bush')} alt="" style={{ right: '6%', top: '44%', width: '20%' }} />
    </>
  )
}
function Market() {
  return (
    <>
      <img src={prop('stall')} alt="" style={{ left: '8%', top: '14%', width: '50%' }} />
      <img src={prop('well')} alt="" style={{ right: '8%', top: '36%', width: '32%' }} />
      <img src={prop('bicycle')} alt="" style={{ left: '14%', top: '68%', width: '30%' }} />
      <img src={prop('signpost')} alt="" style={{ right: '16%', top: '6%', width: '20%' }} />
      <img src={prop('flowerbed')} alt="" style={{ left: '52%', top: '72%', width: '26%' }} />
    </>
  )
}
function Garden() {
  return (
    <>
      <img src={prop('gazebo')} alt="" style={{ left: '26%', top: '18%', width: '48%' }} />
      <img src={prop('tree_cherry')} alt="" style={{ left: '0%', top: '6%', width: '34%' }} />
      <img src={prop('tree_cherry')} alt="" style={{ right: '0%', top: '30%', width: '30%' }} />
      <img src={prop('flowerbed')} alt="" style={{ left: '8%', top: '70%', width: '26%' }} />
      <img src={prop('mailbox')} alt="" style={{ right: '14%', top: '66%', width: '16%' }} />
    </>
  )
}
