import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useApp, useRun } from '../ctx'
import { rpc } from '../lib/api'
import { fmtDay } from '../lib/util'
import { supabase, sharedUrl } from '../lib/supabase'
import { artUrl } from '../lib/rooms'
import type { Book, Course, InventoryRow, Item } from '../lib/types'
import { Sprite } from '../components/ui'
import { onSale } from '../components/Decorate'
import { josa } from '../lib/util'
import { Loading, Sheet } from '../components/ui'

export const SHELF_FLOORS = [
  { key: 'essay', label: '에세이' },
  { key: 'picture', label: '그림책' },
  { key: 'self', label: '자기계발·교육' },
  { key: 'adi', label: '아는디자이너 책' },
  { key: 'club', label: '북클럽에서 읽은 책' },
] as const

export interface ShelfBook { id: string; category: string; title: string; author: string; cover_url: string | null; buy_url: string | null; isbn: string | null; note: string; sort: number; active: boolean }
export interface Exhibition { id: string; round: number; title: string; held_on: string; note: string; active: boolean }
export interface Work { id: string; exhibition_id: string; title: string; artist: string; image_url: string; sort: number }

const PLACES = {
  school: { title: '마을 학교', sub: '눈보라피팅룸의 강의가 모여 있어요', art: 'school' },
  library: { title: '오브북 도서관', sub: '오브북에서 펴낸 책과 북클럽에서 함께 읽은 책이에요', art: 'library' },
  museum: { title: '마을 미술관', sub: '함께 열었던 전시를 회차별로 볼 수 있어요', art: 'museum' },
  plaza: { title: '우리 마을 광장', sub: '아디쌤 소식을 보고, 방명록에 한마디 남겨 보세요', art: 'clocktower' },
  mart: { title: '별마트', sub: '모은 별로 방을 꾸밀 물건과 벽 색을 사는 곳이에요', art: 'mart' },
} as const

export interface TownPost { id: string; body: string; link: string | null; posted_on: string; pinned: boolean; active: boolean }
export interface PlazaNote { id: string; user_id: string; note: string; created_at: string; hidden_at: string | null; profiles: { nickname: string } }

// 마을에서 함께 쓰는 건물: 학교 · 오브북 도서관 · 미술관
export default function Place() {
  const { kind } = useParams()
  const nav = useNavigate()
  if (kind !== 'school' && kind !== 'library' && kind !== 'museum' && kind !== 'plaza' && kind !== 'mart') return <Navigate to="/town" replace />
  const p = PLACES[kind]
  return (
    <div className="split">
      <div className="sticky stack">
        <button className="backlink" onClick={() => nav('/town')}>← 우리 마을로</button>
        <img className="place-art" src={artUrl(`town/${p.art}.webp`)} alt="" />
      </div>
      <div className="stack">
        <section className="card stack">
          <h1>{p.title}</h1>
          <p className="muted">{p.sub}</p>
        </section>
        {kind === 'school' && <School />}
        {kind === 'library' && <Library />}
        {kind === 'museum' && <Museum />}
        {kind === 'plaza' && <Plaza />}
        {kind === 'mart' && <Mart />}
      </div>
    </div>
  )
}

function School() {
  const { me } = useApp()
  const nav = useNavigate()
  const [rows, setRows] = useState<Course[] | null>(null)
  useEffect(() => {
    void supabase.from('courses').select('*').eq('active', true).order('sort').order('title').then(({ data }) => setRows((data ?? []) as Course[]))
  }, [])
  if (!rows) return <Loading />
  const classroom = me?.floors.find((f) => f.kind === 'classroom')
  const stamped = new Set(me?.courses.filter((c) => c.stamps.length > 0).map((c) => c.course_id))
  const groups = [
    { title: '지금 열린 무료특강', list: rows.filter((c) => c.kind === 'free') },
    { title: '강의', list: rows.filter((c) => c.kind === 'course') },
  ]
  return (
    <>
      {rows.length === 0 && <section className="card"><p className="empty">아직 걸린 강의가 없어요.</p></section>}
      {groups.filter((g) => g.list.length > 0).map((g) => (
        <section key={g.title} className="card stack">
          <h2>{g.title}</h2>
          <ul className="list">
            {g.list.map((c) => (
              <li key={c.id}>
                {c.thumbnail_url ? <img className="thumb" src={c.thumbnail_url} alt="" /> : <span className="ico" aria-hidden>{c.kind === 'free' ? '🎟️' : '📘'}</span>}
                <span className="txt"><b>{c.title}</b>{c.kind === 'free' ? '무료특강' : '강의'}{stamped.has(c.id) ? ' · 도장 받음' : ''}</span>
                {c.product_url && <a className="btn small" href={c.product_url} target="_blank" rel="noreferrer">강의 보러 가기</a>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {classroom && <button className="btn primary big" onClick={() => nav(`/floor/${classroom.id}`)}>내 강의실에서 도장 신청하기</button>}
    </>
  )
}

function Library() {
  const [floor, setFloor] = useState<string>('essay')
  const [shelf, setShelf] = useState<ShelfBook[] | null>(null)
  const [club, setClub] = useState<Book[]>([])
  useEffect(() => {
    void supabase.from('shelf_books').select('*').eq('active', true).order('sort').order('created_at').then(({ data }) => setShelf((data ?? []) as ShelfBook[]))
    void supabase.from('books').select('*').eq('active', true).order('month', { ascending: false }).then(({ data }) => setClub((data ?? []) as Book[]))
  }, [])
  if (!shelf) return <Loading />
  const list = floor === 'club'
    ? club.map((b) => ({ id: b.id, title: b.title, author: b.author, cover_url: b.cover_url, buy_url: null as string | null, note: b.month ? `${b.month.slice(0, 7).replace('-', '년 ')}월` : '' }))
    : shelf.filter((b) => b.category === floor)
  return (
    <section className="card stack">
      <div className="chips" role="tablist" aria-label="도서관 층">
        {SHELF_FLOORS.map((f, i) => (
          <button key={f.key} className={`chip${floor === f.key ? ' on' : ''}`} role="tab" aria-selected={floor === f.key} onClick={() => setFloor(f.key)}>{i + 1}층 {f.label}</button>
        ))}
      </div>
      {list.length === 0 ? <p className="empty">이 층은 아직 비어 있어요.</p> : (
        <div className="book-grid">
          {list.map((b) => (
            <div key={b.id} className="book-card">
              {b.cover_url ? <img className="cover" src={sharedUrl(b.cover_url)!} alt="" /> : <div className="cover none"><img src={artUrl('taste/book.webp')} alt="" /></div>}
              <b>{b.title}</b>
              {b.author && <span className="muted small">{b.author}</span>}
              {b.note && <span className="muted small">{b.note}</span>}
              {b.buy_url && <a className="btn small" href={b.buy_url} target="_blank" rel="noreferrer">책 보러 가기</a>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function Museum() {
  const [shows, setShows] = useState<Exhibition[] | null>(null)
  const [works, setWorks] = useState<Work[]>([])
  const [open, setOpen] = useState<Work | null>(null)
  useEffect(() => {
    void supabase.from('exhibitions').select('*').eq('active', true).order('round', { ascending: false }).then(({ data }) => setShows((data ?? []) as Exhibition[]))
    void supabase.from('exhibition_works').select('*').order('sort').order('created_at').then(({ data }) => setWorks((data ?? []) as Work[]))
  }, [])
  if (!shows) return <Loading />
  return (
    <>
      {shows.length === 0 && <section className="card"><p className="empty">아직 걸린 전시가 없어요.</p></section>}
      {shows.map((s) => {
        const list = works.filter((w) => w.exhibition_id === s.id)
        return (
          <section key={s.id} className="card stack">
            <div className="row between">
              <h2>{s.round}회 · {s.title}</h2>
              <span className="muted">{s.held_on}</span>
            </div>
            {s.note && <p>{s.note}</p>}
            {list.length === 0 ? <p className="empty">작품을 준비하고 있어요.</p> : (
              <div className="work-grid">
                {list.map((w) => (
                  <button key={w.id} className="work" onClick={() => setOpen(w)} aria-label={`${w.title || '작품'} 크게 보기`}>
                    <img src={sharedUrl(w.image_url)!} alt="" loading="lazy" />
                    <span>{w.title}{w.artist ? ` · ${w.artist}` : ''}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )
      })}
      {open && (
        <Sheet title={open.title || '작품'} onClose={() => setOpen(null)}>
          <img src={sharedUrl(open.image_url)!} alt={open.title} style={{ width: '100%', borderRadius: 14 }} />
          {open.artist && <p className="center"><b>{open.artist}</b></p>}
        </Sheet>
      )}
    </>
  )
}

// 광장: 아디쌤 소식(단톡방에 올린 글 모음)과 방명록
function Plaza() {
  const { session, isAdmin, toast } = useApp()
  const [busy, run] = useRun()
  const [posts, setPosts] = useState<TownPost[] | null>(null)
  const [notes, setNotes] = useState<PlazaNote[]>([])
  const [text, setText] = useState('')
  const [more, setMore] = useState(false)

  const loadNotes = () =>
    supabase.from('plaza_notes').select('id,user_id,note,created_at,hidden_at, profiles(nickname)').is('hidden_at', null)
      .order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setNotes((data ?? []) as unknown as PlazaNote[]))
  useEffect(() => {
    void supabase.from('town_posts').select('*').eq('active', true).order('pinned', { ascending: false }).order('posted_on', { ascending: false }).order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setPosts((data ?? []) as TownPost[]))
    void loadNotes()
  }, [])
  if (!posts) return <Loading />
  const shown = more ? posts : posts.slice(0, 3)

  return (
    <>
      <section className="card stack">
        <h2>방명록</h2>
        <label className="field">한마디 남기기
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={120} placeholder="예: 오늘도 다들 화이팅이에요!" />
        </label>
        <button className="btn primary big" disabled={busy || !text.trim()}
          onClick={() => run(async () => {
            await rpc('add_plaza_note', { p_note: text })
            setText('')
            await loadNotes()
            toast('방명록에 남겼어요.')
          })}>
          남기기
        </button>
        {notes.length === 0 ? <p className="empty">아직 비어 있어요. 첫 글을 남겨 보세요.</p> : (
          <ul className="list">
            {notes.map((n) => (
              <li key={n.id}>
                <span className="txt"><b>{n.profiles.nickname}님 · {fmtDay(n.created_at)}</b>{n.note}</span>
                {(n.user_id === session?.user.id || isAdmin) && (
                  <button className="btn ghost small" disabled={busy}
                    onClick={() => run(async () => { await rpc('remove_plaza_note', { p_id: n.id }); await loadNotes() })}>
                    {n.user_id === session?.user.id ? '지우기' : '가리기'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card stack">
        <h2>아디쌤 소식</h2>
        {posts.length === 0 && <p className="empty">아직 올라온 소식이 없어요.</p>}
        {shown.map((p) => (
          <article key={p.id} className="post">
            <b>{p.pinned ? '📌 ' : ''}{fmtDay(p.posted_on)}</b>
            <p>{p.body}</p>
            {p.link && <a className="btn small" href={p.link} target="_blank" rel="noreferrer">자세히 보기</a>}
          </article>
        ))}
        {posts.length > 3 && <button className="btn wide" onClick={() => setMore((v) => !v)}>{more ? '접기' : `지난 소식 ${posts.length - 3}개 더 보기`}</button>}
      </section>
    </>
  )
}

const MART_GROUPS: { key: string; title: string; hint: string; test: (it: Item) => boolean }[] = [
  { key: 'table', title: '책상 위 소품', hint: '책상·선반 위에도, 바닥에도 놓을 수 있어요', test: (it) => it.kind === 'object' && it.slot === 'table' },
  { key: 'floor', title: '바닥에 놓는 물건', hint: '방 바닥과 옥상에 놓아요', test: (it) => it.kind === 'object' && it.slot === 'floor' },
  { key: 'wall', title: '벽에 거는 물건', hint: '벽 자리에 걸어요', test: (it) => it.kind === 'object' && it.slot === 'wall' },
  { key: 'paint', title: '벽 색', hint: '한 번 사면 모든 층에 몇 번이든 칠할 수 있어요', test: (it) => it.kind === 'wall_paint' },
]

// 별마트: 별로 살 수 있는 물건을 모두 보고, 여기서 바로 살 수 있다. 산 물건은 보관함에 들어간다.
function Mart() {
  const { me, today, session, reload, toast } = useApp()
  const nav = useNavigate()
  const [busy, run] = useRun()
  const [items, setItems] = useState<Item[] | null>(null)
  const [inv, setInv] = useState<InventoryRow[]>([])
  const [group, setGroup] = useState('table')
  const [pick, setPick] = useState<Item | null>(null)

  const load = async () => {
    const [a, b] = await Promise.all([
      supabase.from('items').select('*').eq('active', true).order('sort').order('price'),
      supabase.from('inventory').select('id,item_id,source,items(*)').eq('user_id', session!.user.id),
    ])
    setItems((a.data ?? []) as Item[])
    setInv((b.data ?? []) as unknown as InventoryRow[])
  }
  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (!items || !today || !me) return <Loading />

  const balance = today.balance
  const selling = items.filter((it) => onSale(it, today.today))
  const owned = new Map<string, number>()
  for (const v of inv) owned.set(v.item_id, (owned.get(v.item_id) ?? 0) + 1)
  const g = MART_GROUPS.find((x) => x.key === group)!
  const list = selling.filter(g.test)

  const buy = (it: Item) =>
    run(async () => {
      await rpc('buy_item', { p_item_id: it.id })
      await Promise.all([reload(), load()])
      setPick(null)
      toast(it.kind === 'wall_paint' ? `${josa(it.name, '을', '를')} 샀어요. 방에서 [벽 색 바꾸기]로 칠해 보세요.` : `${josa(it.name, '을', '를')} 샀어요. 보관함에 넣어 두었어요.`)
    })

  return (
    <>
      <section className="card stack">
        <div className="row between">
          <b>지금 가진 별</b>
          <span className="stars-pill">⭐ {balance}</span>
        </div>
        <div className="chips" role="tablist">
          {MART_GROUPS.map((x) => (
            <button key={x.key} className={`chip${group === x.key ? ' on' : ''}`} role="tab" aria-selected={group === x.key} onClick={() => setGroup(x.key)}>
              {x.title} {selling.filter(x.test).length}
            </button>
          ))}
        </div>
        <p className="muted small">{g.hint}</p>
        {list.length === 0 && <p className="empty">지금은 파는 물건이 없어요.</p>}
        <div className="shop-grid">
          {list.map((it) => {
            const n = owned.get(it.id) ?? 0
            return (
              <button key={it.id} className="shop-item" onClick={() => setPick(it)}>
                <span className="pic">{it.kind === 'wall_paint' ? <i style={{ background: it.color ?? '#fff' }} /> : <Sprite emoji={it.emoji} image={sharedUrl(it.image_url)} label={it.name} />}</span>
                <b>{it.name}</b>
                <span className="price">⭐ {it.price}</span>
                {it.season && <span className="tag">{it.season}</span>}
                {n > 0 && <span className="muted small">{it.kind === 'wall_paint' ? '가지고 있어요' : `${n}개 가지고 있어요`}</span>}
              </button>
            )
          })}
        </div>
      </section>
      <section className="card tight stack">
        <p className="muted">산 물건은 <b>보관함</b>에 들어가요. 내 건물의 방에서 ＋ 자리를 누르면 꺼내 놓을 수 있어요.</p>
        <button className="btn wide" onClick={() => nav('/building')}>내 건물로 가서 꾸미기</button>
      </section>
      {pick && (() => {
        const has = (owned.get(pick.id) ?? 0) > 0
        const paintOwned = pick.kind === 'wall_paint' && has
        const enough = balance >= pick.price
        return (
          <Sheet title={pick.name} onClose={() => setPick(null)}>
            <div className="center" style={{ fontSize: '5rem', lineHeight: 1.1 }}>
              {pick.kind === 'wall_paint'
                ? <i style={{ display: 'inline-block', width: 120, height: 120, borderRadius: 24, background: pick.color ?? '#fff', border: '3px solid var(--line)' }} />
                : <Sprite emoji={pick.emoji} image={sharedUrl(pick.image_url)} label={pick.name} />}
            </div>
            <p className="center">별 <b>{pick.price}개</b>가 들어요. 지금 가진 별은 {balance}개예요.</p>
            {paintOwned ? (
              <p className="empty">이미 가지고 있는 색이에요. 방에서 [벽 색 바꾸기]로 칠할 수 있어요.</p>
            ) : enough ? (
              <button className="btn primary big" disabled={busy} onClick={() => buy(pick)}>별 {pick.price}개로 사기</button>
            ) : (
              <p className="empty">별이 {pick.price - balance}개 모자라요. 기록을 남기면 별이 모여요.</p>
            )}
            <button className="btn ghost wide" onClick={() => setPick(null)}>다른 물건 보기</button>
          </Sheet>
        )
      })()}
    </>
  )
}
