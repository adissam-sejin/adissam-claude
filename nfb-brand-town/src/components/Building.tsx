import type { CSSProperties } from 'react'
import type { Building, Floor, FloorKind, Placement, TownBuilding } from '../lib/types'
import { channelInfo, floorNumber, floorTitle, newsInfo, seeded, shade } from '../lib/util'
import { sharedUrl } from '../lib/supabase'
import { Sprite } from './ui'

// 방 종류마다 물건을 놓을 수 있는 자리. f = 바닥(왼쪽 %, 폭 %), w = 벽(왼쪽 %, 위 %)
export const SLOTS: Record<FloorKind, { f: [number, number][]; w: [number, number][] }> = {
  sns: { f: [[4, 17], [24, 17], [53, 17], [76, 17]], w: [[62, 12], [81, 12]] },
  classroom: { f: [[3, 17], [22, 17], [60, 17], [80, 17]], w: [[5, 12], [81, 12]] },
  library: { f: [[6, 17], [28, 17], [55, 17], [78, 17]], w: [[69, 12], [85, 12]] },
  lobby: { f: [[30, 13], [56, 12]], w: [] },
  rooftop: { f: [[5, 16], [23, 16], [41, 16], [59, 16], [77, 16]], w: [] },
}

export const slotKeys = (kind: FloorKind) => [
  ...SLOTS[kind].f.map((_, i) => `f${i + 1}`),
  ...SLOTS[kind].w.map((_, i) => `w${i + 1}`),
]

const DEFAULT_WALL = '#F4E4C8'
const SPINE_COLORS = ['#B5403A', '#2F7D5B', '#C9A227', '#3E8FC2', '#6B4FA0', '#E0705A', '#7A5236', '#14907F']

interface Props {
  b: Building
  onFloor?: (f: Floor) => void
  only?: string
  onSlot?: (f: Floor, slotKey: string, current?: Placement) => void
  sky?: boolean
}

export function BuildingView({ b, onFloor, only, onSlot, sky = true }: Props) {
  const color = b.profile.brand_color
  const style = {
    '--brand': color,
    '--brand-dark': shade(color, -0.14),
    '--brand-light': shade(color, 0.16),
  } as CSSProperties
  const all = [...b.floors].sort((x, y) => y.position - x.position)
  const shown = only ? all.filter((f) => f.id === only) : all
  const banner = b.news.find((n) => n.on_banner)
  const topFloorId = all.find((f) => f.kind !== 'rooftop')?.id

  return (
    <div className={`bld${only ? ' bld-single' : ''}`} style={style}>
      {sky && !only && <Sky n={b.stars_earned} seed={b.profile.id} />}
      <div className="bld-body">
        {shown.map((f) => (
          <FloorRow
            key={f.id}
            b={b}
            f={f}
            label={f.kind === 'rooftop' ? '옥상' : `${floorNumber(b.floors, f)} · ${floorTitle(f)}`}
            onFloor={onFloor}
            onSlot={onSlot}
            banner={!only && banner && f.id === topFloorId ? `경축 · ${newsInfo(banner.kind).banner}` : undefined}
          />
        ))}
        {!only && <div className="bld-ground" />}
      </div>
    </div>
  )
}

function Sky({ n, seed }: { n: number; seed: string }) {
  const count = Math.min(n, 70)
  const r = seeded(seed, count * 3)
  return (
    <div className="bld-sky" aria-label={`지금까지 모은 별 ${n}개`}>
      <i className="moon" />
      {Array.from({ length: count }, (_, i) => (
        <i
          key={i}
          className="star"
          style={{
            left: `${4 + r[i * 3] * 92}%`,
            top: `${6 + r[i * 3 + 1] * 80}%`,
            animationDelay: `${(r[i * 3 + 2] * 4).toFixed(2)}s`,
            transform: `scale(${0.6 + r[i * 3 + 2] * 0.9})`,
          }}
        />
      ))}
    </div>
  )
}

function FloorRow({
  b, f, label, onFloor, onSlot, banner,
}: {
  b: Building
  f: Floor
  label: string
  onFloor?: (f: Floor) => void
  onSlot?: (f: Floor, slotKey: string, current?: Placement) => void
  banner?: string
}) {
  const layout = SLOTS[f.kind]
  const byKey = new Map(f.placements.map((p) => [p.slot_key, p]))
  const tappable = Boolean(onFloor)

  const slot = (key: string, st: CSSProperties, wall: boolean) => {
    const p = byKey.get(key)
    const cls = `slot ${wall ? 'slot-w' : 'slot-f'}`
    if (onSlot) {
      return (
        <button
          key={key}
          className={`${cls} slot-btn${p ? '' : ' slot-empty'}`}
          style={st}
          onClick={(e) => {
            e.stopPropagation()
            onSlot(f, key, p)
          }}
          aria-label={p ? `${p.item.name} 바꾸기` : '빈 자리에 물건 놓기'}
        >
          {p ? <Sprite emoji={p.item.emoji} image={sharedUrl(p.item.image_url)} label={p.item.name} /> : <span aria-hidden>＋</span>}
        </button>
      )
    }
    if (!p) return null
    return (
      <span key={key} className={cls} style={st}>
        <Sprite emoji={p.item.emoji} image={sharedUrl(p.item.image_url)} label={p.item.name} />
      </span>
    )
  }

  const inner = (
    <>
      {f.kind !== 'rooftop' && (
        <div className="fl-pillar l">
          <i className="win" />
        </div>
      )}
      <div className="fl-room">
        <div className="fl-wall">
          <Fixture b={b} f={f} />
          {layout.w.map(([x, y], i) => slot(`w${i + 1}`, { left: `${x}%`, top: `${y}%` }, true))}
        </div>
        <div className="fl-planks" />
        {layout.f.map(([x, w], i) => slot(`f${i + 1}`, { left: `${x}%`, width: `${w}%` }, false))}
        <span className="fl-tag">{label}</span>
        {banner && <span className="banner">🎉 {banner}</span>}
      </div>
      {f.kind !== 'rooftop' && (
        <div className="fl-pillar r">
          <i className="win" />
        </div>
      )}
    </>
  )

  const st = { '--wall': f.wall_color ?? DEFAULT_WALL } as CSSProperties
  if (tappable) {
    return (
      <div
        className={`fl fl-${f.kind} fl-tap`}
        style={st}
        role="button"
        tabIndex={0}
        aria-label={`${label} 들어가기`}
        onClick={() => onFloor!(f)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onFloor!(f)}
      >
        {inner}
      </div>
    )
  }
  return (
    <div className={`fl fl-${f.kind}`} style={st}>
      {inner}
    </div>
  )
}

function Fixture({ b, f }: { b: Building; f: Floor }) {
  switch (f.kind) {
    case 'sns': {
      const info = channelInfo(f.channel_type)
      const books = Math.floor(f.record_count / 10)
      const loose = f.record_count % 10
      const r = seeded(f.id, 12)
      return (
        <>
          <div className="fx fx-board" aria-label={`기록 ${f.record_count}개`}>
            <span className="fx-board-icon" aria-hidden>{info.emoji}</span>
            {Array.from({ length: Math.min(loose, 9) }, (_, i) => (
              <i key={i} className="memo" style={{ transform: `rotate(${(r[i] * 10 - 5).toFixed(1)}deg)`, background: ['#fff', '#FFE9A8', '#FFD0C2', '#CFE8D5'][i % 4] }} />
            ))}
          </div>
          {books > 0 && (
            <div className="fx fx-scrap" aria-label={`스크랩북 ${books}권`}>
              {Array.from({ length: Math.min(books, 10) }, (_, i) => (
                <i key={i} style={{ background: SPINE_COLORS[i % SPINE_COLORS.length] }} />
              ))}
            </div>
          )}
        </>
      )
    }
    case 'classroom': {
      const stamps = b.courses.reduce((n, c) => n + c.stamps.length, 0)
      return (
        <div className="fx fx-chalk" aria-label={`강의 도장 ${stamps}개`}>
          {Array.from({ length: Math.min(stamps, 10) }, (_, i) => (
            <i key={i} className="stampdot" />
          ))}
          {stamps === 0 && <span className="fx-hint">도장판</span>}
        </div>
      )
    }
    case 'library': {
      const r = seeded(f.id, 40)
      return (
        <div className="fx fx-shelf" aria-label={`읽은 책 ${b.readings.length}권`}>
          {b.readings.slice(0, 24).map((rd, i) => (
            <i key={rd.id} className="spine" title={rd.title}
               style={{ background: SPINE_COLORS[i % SPINE_COLORS.length], height: `${72 + r[i] * 24}%` }} />
          ))}
          {b.readings.length === 0 && <span className="fx-hint">책장</span>}
        </div>
      )
    }
    case 'lobby': {
      const taste = b.taste.slice(-10)
      return (
        <>
          <div className="fx fx-awning" />
          <div className="fx fx-sign">{b.profile.brand_name || b.profile.nickname}</div>
          <div className="fx fx-window" aria-label="쇼윈도">
            {b.my_books.slice(0, 3).map((mb) => (
              <i key={mb.id} className={`wbook st-${mb.stage}`} title={mb.title}
                 style={mb.cover_url ? { backgroundImage: `url(${sharedUrl(mb.cover_url)})` } : undefined} />
            ))}
          </div>
          <div className="fx fx-door"><i /></div>
          <div className="fx fx-taste" aria-label={`좋아하는 것 ${b.taste.length}개`}>
            {taste.map((t) => (
              <span key={t.id} title={t.label}>
                {t.kind === 'photo' && t.photo_path
                  ? <img src={sharedUrl(t.photo_path)!} alt={t.label} />
                  : t.emoji ?? (t.shape === 'book' ? '📕' : t.shape === 'record' ? '💿' : '📝')}
              </span>
            ))}
          </div>
        </>
      )
    }
    case 'rooftop':
      return (
        <>
          <div className="fx fx-lights">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</div>
          <div className="fx fx-flag"><i /></div>
          <div className="fx fx-rail" />
        </>
      )
  }
}

// 마을 지도에 서는 작은 건물
export function MiniBuilding({ t }: { t: TownBuilding }) {
  const floors = [...t.floors].reverse().filter((f) => f.kind !== 'rooftop')
  const style = {
    '--brand': t.brand_color,
    '--brand-dark': shade(t.brand_color, -0.14),
  } as CSSProperties
  return (
    <div className="mini" style={style} aria-hidden>
      <div className="mini-roof"><i /></div>
      {floors.map((f, i) => (
        <div key={i} className={`mini-fl${f.kind === 'lobby' ? ' mini-lobby' : ''}`}
             style={{ '--wall': f.wall_color ?? DEFAULT_WALL } as CSSProperties}>
          {f.kind === 'lobby' ? <><i className="mw" /><i className="md" /><i className="mw" /></> : <><i className="mw" /><i className="mw" /><i className="mw" /></>}
        </div>
      ))}
      {t.banner && <span className="mini-banner">🎉</span>}
    </div>
  )
}
