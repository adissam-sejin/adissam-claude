import type { CSSProperties, ReactNode } from 'react'
import type { Building, ChannelType, Floor, FloorKind, Placement, TownBuilding } from '../lib/types'
import { floorNumber, floorTitle, newsInfo, seeded, shade } from '../lib/util'
import { LOBBY, ROOMS, SLOT_LABEL, artUrl, itemHeight, maskUrl, roomArt, roomUrl, slotKind, tasteArt, type RoomArt } from '../lib/rooms'
import { sharedUrl } from '../lib/supabase'
import { Sprite } from './ui'

const MEMO_HUES = [0, -28, 60, 150, 200, 300, 95, 0, 240]
const pct = (n: number) => `${n}%`

function brandVars(color: string): CSSProperties {
  return { '--brand': color, '--brand-dark': shade(color, -0.14), '--brand-light': shade(color, 0.16) } as CSSProperties
}

// 방 그림 한 장: 그림 + 브랜드 색 칠 + 벽 색
function RoomPicture({ art, wallColor, small }: { art: RoomArt; wallColor: string | null; small?: boolean }) {
  const mask = `url(${maskUrl(art, small)})`
  return (
    <>
      <img className="fl-art" src={roomUrl(art, small)} alt="" draggable={false} />
      {wallColor && art !== 'rooftop' && <i className="fl-paint" style={{ background: wallColor }} />}
      {ROOMS[art].tinted && <i className="fl-tint" style={{ maskImage: mask, WebkitMaskImage: mask }} />}
    </>
  )
}

interface Props {
  b: Building
  onFloor?: (f: Floor) => void
  only?: string
  onSlot?: (f: Floor, slotKey: string, current?: Placement) => void
  sky?: boolean
}

export function BuildingView({ b, onFloor, only, onSlot, sky = true }: Props) {
  const all = [...b.floors].sort((x, y) => y.position - x.position)
  const shown = only ? all.filter((f) => f.id === only) : all
  const banner = b.news.find((n) => n.on_banner)
  const topFloorId = all.find((f) => f.kind !== 'rooftop')?.id

  return (
    <div className={`bld${only ? ' bld-single' : ''}`} style={brandVars(b.profile.brand_color)}>
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

export function Sky({ n, seed }: { n: number; seed: string }) {
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
  const art = roomArt(f)
  const L = ROOMS[art]
  const byKey = new Map(f.placements.map((p) => [p.slot_key, p]))

  // x: 가운데, y: 벽 자리는 가운데 높이(위에서부터), 바닥·책상 자리는 물건이 서는 높이(아래에서부터)
  const slot = (key: string, x: number, y: number): ReactNode => {
    const p = byKey.get(key)
    const kind = slotKind(key)
    const h = p ? itemHeight(key, p.item.size ?? 1, L.scale ?? 1) : kind === 'wall' ? 28 : kind === 'table' ? 15 : 30 * (L.scale ?? 1)
    const st: CSSProperties = kind === 'wall' ? { left: pct(x), top: pct(y), height: pct(h) } : { left: pct(x), bottom: pct(y), height: pct(h) }
    const cls = `slot slot-${kind[0]}`
    const pic = p && <Sprite emoji={p.item.emoji} image={sharedUrl(p.item.image_url)} label={p.item.name} />
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
          aria-label={p ? `${p.item.name} 바꾸기` : `${SLOT_LABEL[kind]} 빈 자리에 물건 놓기`}
        >
          {pic ?? <span aria-hidden>＋</span>}
        </button>
      )
    }
    if (!p) return null
    return <span key={key} className={cls} style={st}>{pic}</span>
  }

  const inner = (
    <>
      {f.kind !== 'rooftop' && <div className="fl-pillar l"><i className="win" /></div>}
      <div className="fl-room" style={{ aspectRatio: String(L.ratio) }}>
        <RoomPicture art={art} wallColor={f.wall_color} />
        <Overlays b={b} f={f} art={art} />
        {L.wall.map(([x, y], i) => slot(`w${i + 1}`, x, y))}
        {(L.table ?? []).map(([x, y], i) => slot(`t${i + 1}`, x, 100 - y))}
        {L.floor.map((x, i) => slot(`f${i + 1}`, x, L.floorY))}
        <span className="fl-tag">{label}</span>
        {banner && <span className="banner">🎉 {banner}</span>}
      </div>
      {f.kind !== 'rooftop' && <div className="fl-pillar r"><i className="win" /></div>}
    </>
  )

  if (onFloor) {
    return (
      <div
        className={`fl fl-${f.kind} fl-tap`}
        role="button"
        tabIndex={0}
        aria-label={`${label} 들어가기`}
        onClick={() => onFloor(f)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onFloor(f)}
      >
        {inner}
      </div>
    )
  }
  return <div className={`fl fl-${f.kind}`}>{inner}</div>
}

// 그림 위에 얹는 것: 기록 쪽지·스크랩북, 강의 도장, 읽은 책, 간판 글자·쇼윈도·취향
function Overlays({ b, f, art }: { b: Building; f: Floor; art: RoomArt }) {
  const L = ROOMS[art]
  const box = ([x, y, w, h]: readonly number[]): CSSProperties => ({ left: pct(x), top: pct(y), width: pct(w), height: pct(h) })

  if (f.kind === 'sns' && L.board && L.plank) {
    const albums = Math.floor(f.record_count / 10)
    const loose = f.record_count % 10
    const [px, py, pw] = L.plank
    return (
      <>
        <div className="ov ov-board" style={box(L.board)} aria-label={`기록 ${f.record_count}개`}>
          {Array.from({ length: loose }, (_, i) => (
            <img key={i} src={artUrl('taste/memo.webp')} alt="" style={{ filter: `hue-rotate(${MEMO_HUES[i % MEMO_HUES.length]}deg)` }} />
          ))}
        </div>
        {albums > 0 && (
          <div className="ov ov-plank" style={{ left: pct(px), width: pct(pw), top: pct(py - 17), height: pct(17) }} aria-label={`스크랩북 ${albums}권`}>
            {Array.from({ length: Math.min(albums, 4) }, (_, i) => <img key={i} src={artUrl('taste/scrapbook.webp')} alt="" />)}
            {albums > 4 && <b>×{albums}</b>}
          </div>
        )}
      </>
    )
  }
  if (f.kind === 'classroom' && L.chalk) {
    const stamps = b.courses.reduce((n, c) => n + c.stamps.length, 0)
    return (
      <div className="ov ov-chalk" style={box(L.chalk)} aria-label={`강의 도장 ${stamps}개`}>
        {Array.from({ length: Math.min(stamps, 14) }, (_, i) => <i key={i} className="stampdot" />)}
        {stamps > 14 && <b>+{stamps - 14}</b>}
      </div>
    )
  }
  if (f.kind === 'library' && L.shelves) {
    const r = seeded(f.id, 40)
    const perRow = 13
    return (
      <>
        {L.shelves.map(([x, bottom, w], row) => (
          <div key={row} className="ov ov-shelf" style={{ left: pct(x), width: pct(w), top: pct(bottom - 23), height: pct(23) }}>
            {b.readings.slice(row * perRow, (row + 1) * perRow).map((rd, i) => (
              <img key={rd.id} src={artUrl(`books/book${((row * perRow + i) % 10) + 1}.webp`)} alt="" title={rd.title}
                   style={{ height: pct(74 + r[row * perRow + i] * 26) }} />
            ))}
          </div>
        ))}
      </>
    )
  }
  if (f.kind === 'lobby') {
    const taste = b.taste.slice(-8)
    const [wx, wy, ww] = LOBBY.windowBooks
    return (
      <>
        <div className="ov ov-sign" style={box(LOBBY.sign)}><SignText text={b.profile.brand_name || b.profile.nickname} /></div>
        <div className="ov ov-window" style={{ left: pct(wx), width: pct(ww), top: pct(wy - 26), height: pct(26) }} aria-label="쇼윈도">
          {b.my_books.slice(0, 3).map((mb) =>
            mb.cover_url
              ? <img key={mb.id} className={`cover st-${mb.stage}`} src={sharedUrl(mb.cover_url)!} alt={mb.title} />
              : <img key={mb.id} className={`st-${mb.stage}`} src={artUrl('taste/book.webp')} alt={mb.title} />,
          )}
        </div>
        {LOBBY.cubbies.map(([x, bottom, w], c) => (
          <div key={c} className="ov ov-cubby" style={{ left: pct(x), width: pct(w), top: pct(bottom - 19), height: pct(19) }}>
            {taste.slice(c * 2, c * 2 + 2).map((t) => {
              const src = t.kind === 'photo' ? sharedUrl(t.photo_path) : tasteArt(t)
              return src
                ? <img key={t.id} className={t.kind === 'photo' ? 'photo' : ''} src={src} alt={t.label} title={t.label} />
                : <span key={t.id} title={t.label}>{t.emoji ?? '📝'}</span>
            })}
          </div>
        ))}
      </>
    )
  }
  return null
}

// 간판 글자: 길면 두 줄로 나누고 글자 수에 맞춰 크기를 줄인다.
function SignText({ text }: { text: string }) {
  const len = [...text].length
  const lines = len > 6 ? 2 : 1
  const perLine = Math.ceil(len / lines)
  // 간판 안쪽은 폭 약 16.7, 높이 약 4.9 (건물 폭을 100 으로 볼 때)
  const size = Math.min(lines === 1 ? 4.2 : 2.25, 15.8 / Math.max(perLine, 1))
  return <span style={{ fontSize: `max(8px, ${size.toFixed(2)}cqw)`, whiteSpace: lines === 2 ? 'normal' : 'nowrap' }}>{text}</span>
}

// 마을 지도에 서는 건물: 실제 방 그림을 작게 쌓아 보여준다.
export function MiniBuilding({ t }: { t: Pick<TownBuilding, 'brand_color' | 'floors' | 'banner'> }) {
  const floors = [...t.floors].reverse()
  return (
    <div className="bld bld-mini" style={brandVars(t.brand_color)} aria-hidden>
      <div className="bld-body">
        {floors.map((f, i) => <MiniFloor key={i} kind={f.kind} channel={f.channel_type} wall={f.wall_color} />)}
      </div>
      {t.banner && <span className="mini-banner">🎉</span>}
    </div>
  )
}

function MiniFloor({ kind, channel, wall }: { kind: FloorKind; channel: ChannelType | null; wall: string | null }) {
  const art = roomArt({ kind, channel_type: channel })
  return (
    <div className={`fl fl-${kind}`}>
      {kind !== 'rooftop' && <div className="fl-pillar l"><i className="win" /></div>}
      <div className="fl-room" style={{ aspectRatio: String(ROOMS[art].ratio) }}>
        <RoomPicture art={art} wallColor={wall} small />
      </div>
      {kind !== 'rooftop' && <div className="fl-pillar r"><i className="win" /></div>}
    </div>
  )
}
