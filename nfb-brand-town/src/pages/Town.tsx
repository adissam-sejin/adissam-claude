import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../ctx'
import { api } from '../lib/api'
import type { Building, Town, TownBuilding } from '../lib/types'
import { BuildingView } from '../components/Building'
import { Loading, Sheet } from '../components/ui'
import { artUrl } from '../lib/rooms'
import { fmtDay, newsInfo, seeded, shade } from '../lib/util'

const prop = (name: string) => artUrl(`town/${name}.webp`)
// 마당 소품과 그 크기(건물 한 칸 폭에 대한 %)
const YARD: [string, number][] = [['tree_round', 34], ['bush', 22], ['tree_cherry', 34], ['flowerbed', 24], ['tree_pine', 28], ['lamp', 14], ['mailbox', 14], ['rock', 18], ['bush', 22], ['lamp', 14]]
const FOREST = ['tree_pine', 'tree_round', 'tree_pine', 'bush', 'tree_cherry', 'tree_pine', 'tree_round', 'rock']
const SHARED = [
  { kind: 'school', name: '학교' },
  { kind: 'library', name: '오브북 도서관' },
  { kind: 'museum', name: '미술관' },
] as const

// 하늘에서 내려다본 집 한 채. 지붕과 문이 브랜드 색이고, 층수만큼 높다.
function House({ t }: { t: TownBuilding }) {
  const storeys = t.floors.filter((f) => f.kind !== 'rooftop').length
  const n = Math.max(1, Math.min(4, storeys - 3))
  const name = `h${t.plot_no % 2 ? 'a' : 'b'}${n}`
  const mask = `url(${prop(`${name}_mask`)})`
  return (
    <span className="ext" style={{ '--brand': t.brand_color, '--brand-dark': shade(t.brand_color, -0.14) } as CSSProperties}>
      <img src={prop(name)} alt="" draggable={false} />
      <i style={{ maskImage: mask, WebkitMaskImage: mask }} />
    </span>
  )
}

// 우리 마을 지도: 돌길로 나뉜 풀밭 구획에 집들이 모여 있다. 순위도, 뒤로 밀리는 건물도 없다.
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

  const shared = (i: number) => (
    <button key={SHARED[i].kind} className={`block shared s-${SHARED[i].kind}`} onClick={() => nav(`/place/${SHARED[i].kind}`)} aria-label={`${SHARED[i].name} 들어가기`}>
      <img src={prop(SHARED[i].kind)} alt="" />
      <span className="shared-name">{SHARED[i].name}</span>
    </button>
  )
  const rests = [<Park key="park" />, <Market key="market" />, <Garden key="garden" />]

  // 집 네 채가 한 구획. 사이사이에 미술관과 공원·장터 같은 쉼터 구획이 들어간다.
  const blocks: ReactNode[] = [shared(0), shared(1)]
  const groups: TownBuilding[][] = []
  for (let i = 0; i < town.buildings.length; i += 4) groups.push(town.buildings.slice(i, i + 4))
  groups.forEach((group, b) => {
    blocks.push(
      <div key={`b${b}`} className="block houses">
        {group.map((t) => {
          const r = seeded(`yard-${t.plot_no}`, 4)
          const yard = YARD[Math.floor(r[0] * YARD.length)]
          const mine = t.id === town.me
          return (
            <button key={t.id} className={`lot${mine ? ' me' : ''}`} onClick={() => setSel(t)}
              aria-label={`${t.brand_name || t.nickname} 건물${mine ? ' (내 건물)' : ''} 크게 보기`}>
              <House t={t} />
              <img className="lot-yard" src={prop(yard[0])} alt="" style={{ [r[1] > 0.5 ? 'left' : 'right']: '0%', width: `${yard[1] * (0.9 + r[2] * 0.25)}%` } as CSSProperties} />
              {t.banner && <span className="lot-flag" aria-hidden>🎉</span>}
              <span className={`lot-name${mine ? ' always' : ''}`}>{nameOf(t)}</span>
            </button>
          )
        })}
      </div>,
    )
    if (b === 1) blocks.push(shared(2))
    if (b % 3 === 2) blocks.push(<div key={`r${b}`} className="block rest" aria-hidden>{rests[Math.floor(b / 3) % rests.length]}</div>)
  })
  if (groups.length < 2) blocks.push(shared(2))
  // 마지막 줄이 비지 않게 공원·장터로 채운다 (광장이 두 칸을 차지한다).
  for (let k = 0; (blocks.length + 2) % 4 !== 0; k++) {
    blocks.push(<div key={`fill${k}`} className="block rest" aria-hidden>{rests[(Math.floor(groups.length / 3) + k) % rests.length]}</div>)
  }

  const forest = seeded('forest', 90)
  return (
    <div className="stack">
      <div className="gmap">
        <div className="gmap-forest" aria-hidden>
          {Array.from({ length: 30 }, (_, i) => {
            const side = i % 4 // 위·아래·왼쪽·오른쪽 가장자리에 숲을 두른다
            const along = forest[i * 3] * 96 + 1
            const depth = forest[i * 3 + 1]
            const st: CSSProperties =
              side === 0 ? { left: `${along}%`, top: `${-1 + depth * 2}%` }
              : side === 1 ? { left: `${along}%`, bottom: `${-0.6 + depth * 2}%` }
              : side === 2 ? { left: `${-2 + depth * 3}%`, top: `${along}%` }
              : { right: `${-2 + depth * 3}%`, top: `${along}%` }
            return <img key={i} className={side > 1 ? 'side' : ''} src={prop(FOREST[Math.floor(forest[i * 3 + 2] * FOREST.length)])} alt="" style={st} />
          })}
        </div>
        <div className="fireflies" aria-hidden>{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 97}%`, top: `${(i * 53) % 93}%`, animationDelay: `${(i * 0.7) % 5}s` }} />)}</div>
        <div className="gmap-town">
          <div className="block plaza2">
            <img className="pz-tower" src={prop('clocktower')} alt="" />
            <img className="pz-tree l" src={prop('tree_cherry')} alt="" />
            <img className="pz-tree r" src={prop('tree_round')} alt="" />
            <img className="pz-lamp l" src={prop('lamp')} alt="" />
            <img className="pz-lamp r" src={prop('lamp')} alt="" />
            <img className="pz-bench" src={prop('bench')} alt="" />
            <img className="pz-fountain" src={prop('fountain')} alt="" />
            <button className="pz-board" onClick={() => nav('/place/plaza')} aria-label="광장 방명록과 아디쌤 소식 보기">
              <img src={prop('noticeboard')} alt="" />
            </button>
            <button className="shared-name plaza-name" onClick={() => nav('/place/plaza')}>광장 들어가기</button>
          </div>
          {blocks}
        </div>
        <div className="gmap-road" aria-hidden />
      </div>

      <section className="card tight">
        <p><b>이번 주 우리 마을 기록 {town.week_total}개 · 건물 {town.buildings.length}채</b></p>
        <p className="muted">건물을 누르면 크게 볼 수 있어요. 광장·학교·오브북 도서관·미술관은 모두가 함께 쓰는 곳이에요.</p>
      </section>

      <section className="card stack">
        <div className="row between">
          <h2>이름으로 찾기</h2>
          <button className="btn small" onClick={() => setFinder((v) => !v)}>{finder ? '접기' : '펼치기'}</button>
        </div>
        {finder && (
          <div className="chips">
            {town.buildings.map((t) => (
              <button key={t.id} className="chip" onClick={() => setSel(t)}>
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

      {sel && <Peek t={sel} mine={sel.id === town.me} title={nameOf(sel)} onGo={() => go(sel.id)} onClose={() => setSel(null)} />}
    </div>
  )
}

// 지도에서 건물을 누르면: 그 건물의 속 모습을 크게 보여준다.
function Peek({ t, mine, title, onGo, onClose }: { t: TownBuilding; mine: boolean; title: string; onGo: () => void; onClose: () => void }) {
  const [b, setB] = useState<Building | null>(null)
  useEffect(() => {
    let live = true
    api.building(t.id).then((x) => live && setB(x)).catch(() => undefined)
    return () => { live = false }
  }, [t.id])
  return (
    <Sheet title={title} onClose={onClose}>
      <p>{mine ? '' : `${t.nickname}님 · `}{t.week_count > 0 ? `이번 주 ${t.week_count}개째 만드는 중이에요.` : '이번 주를 준비하고 있어요.'}{t.banner ? ` 🎉 ${newsInfo(t.banner.kind).banner}` : ''}</p>
      <div className="peek-night">{b ? <BuildingView b={b} /> : <Loading />}</div>
      {b && (
        <div className="kv">
          <span>도장 {b.stamps}개</span>
          <span>기록 {b.records}개</span>
          <span>모은 별 {b.stars_earned}개</span>
        </div>
      )}
      <button className="btn primary big" onClick={onGo}>{mine ? '내 건물로 가기' : '놀러 가서 응원하기'}</button>
    </Sheet>
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
