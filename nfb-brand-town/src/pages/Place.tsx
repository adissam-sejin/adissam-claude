import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../ctx'
import { supabase, sharedUrl } from '../lib/supabase'
import { artUrl } from '../lib/rooms'
import type { Book, Course } from '../lib/types'
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
} as const

// 마을에서 함께 쓰는 건물: 학교 · 오브북 도서관 · 미술관
export default function Place() {
  const { kind } = useParams()
  const nav = useNavigate()
  if (kind !== 'school' && kind !== 'library' && kind !== 'museum') return <Navigate to="/town" replace />
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
  const taking = new Set(me?.courses.filter((c) => c.enrolled).map((c) => c.course_id))
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
                <span className="txt"><b>{c.title}</b>{c.kind === 'free' ? '무료특강' : `모두 ${c.session_count}강`}{taking.has(c.id) ? ' · 듣는 중' : ''}</span>
                {c.product_url && <a className="btn small" href={c.product_url} target="_blank" rel="noreferrer">강의 보러 가기</a>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {classroom && <button className="btn primary big" onClick={() => nav(`/floor/${classroom.id}`)}>내 강의실에서 도장 받기</button>}
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
