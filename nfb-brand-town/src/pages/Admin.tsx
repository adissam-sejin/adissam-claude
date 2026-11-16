import { useCallback, useEffect, useState } from 'react'
import { useApp, useRun } from '../ctx'
import { rpc, shrinkImage } from '../lib/api'
import { supabase, sharedUrl } from '../lib/supabase'
import type { Book, Course, Item } from '../lib/types'
import { fmtDay, fmtFullDay, newsInfo } from '../lib/util'
import { Loading, Sprite } from '../components/ui'
import { SHELF_FLOORS, type Exhibition, type PlazaNote, type ShelfBook, type TownPost, type Work } from './Place'

const TABS = ['요약', '광장', '수료', '소식', '강의', '책', '오브북', '전시', '물건', '초대', '기록', '설정'] as const
type Tab = (typeof TABS)[number]

export default function Admin() {
  const [tab, setTab] = useState<Tab>('요약')
  return (
    <div className="stack">
      <h1 className="on-night">관리</h1>
      <div className="adm-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} className={`chip${tab === t ? ' on' : ''}`} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === '요약' && <Summary />}
      {tab === '광장' && <PlazaAdmin />}
      {tab === '수료' && <Completions />}
      {tab === '소식' && <NewsAdmin />}
      {tab === '강의' && <Courses />}
      {tab === '책' && <Books />}
      {tab === '오브북' && <ShelfAdmin />}
      {tab === '전시' && <ExhibitAdmin />}
      {tab === '물건' && <Items />}
      {tab === '초대' && <Invites />}
      {tab === '기록' && <Records />}
      {tab === '설정' && <Settings />}
    </div>
  )
}

function useLoad<T>(fn: () => Promise<T>): [T | null, () => void] {
  const [data, setData] = useState<T | null>(null)
  const { fail } = useApp()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => { fn().then(setData).catch(fail) }, [])
  useEffect(load, [load])
  return [data, load]
}

function CopyBox({ title, text }: { title: string; text: string }) {
  const { toast } = useApp()
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row between">
        <b>{title}</b>
        <button className="btn small" onClick={async () => {
          try { await navigator.clipboard.writeText(text); toast('복사했어요.') } catch { toast('복사하지 못했어요. 글자를 길게 눌러 복사해 주세요.') }
        }}>복사</button>
      </div>
      <div className="copybox">{text}</div>
    </div>
  )
}

interface SummaryData {
  last_week_start: string; members: number; achieved: number; active_last_week: number; records_last_week: number
  first_stopped: string[]; long_stopped: string[]; pending_completions: number; news_waiting: number; this_week_records: number
}

function Summary() {
  const [s] = useLoad(() => rpc<SummaryData>('admin_summary'))
  if (!s) return <Loading />
  const origin = window.location.origin
  const end = new Date(s.last_week_start)
  end.setDate(end.getDate() + 6)
  return (
    <>
      <section className="card stack">
        <h2>지난주 ({fmtDay(s.last_week_start)} ~ {fmtDay(end.toISOString())})</h2>
        <table className="tbl">
          <tbody>
            <tr><th>목표를 채운 분</th><td>{s.achieved}명 / {s.members}명</td></tr>
            <tr><th>기록을 남긴 분</th><td>{s.active_last_week}명 · 기록 {s.records_last_week}개</td></tr>
            <tr><th>처음 멈춘 분</th><td>{s.first_stopped.length}명{s.first_stopped.length ? ` — ${s.first_stopped.join(', ')}` : ''}</td></tr>
            <tr><th>2주 이상 멈춘 분</th><td>{s.long_stopped.length}명{s.long_stopped.length ? ` — ${s.long_stopped.join(', ')}` : ''}</td></tr>
            <tr><th>수료 확인 대기</th><td>{s.pending_completions}건</td></tr>
            <tr><th>소개를 기다리는 소식</th><td>{s.news_waiting}건</td></tr>
          </tbody>
        </table>
      </section>
      <section className="card stack">
        <h2>단톡방에 붙여넣을 문구</h2>
        <CopyBox title="월요일 아침" text={`이번 주도 시작해요 🌙\n지난주에는 ${s.achieved}분이 도장을 받으셨고, 우리 마을에 기록 ${s.records_last_week}개가 쌓였어요.\n이번 주도 작은 것 하나부터 남겨 보세요.\n👉 ${origin}`} />
        <CopyBox title="수요일" text={`벌써 수요일이에요.\n이번 주 우리 마을에는 기록 ${s.this_week_records}개가 쌓였어요.\n아직이어도 괜찮아요. 오늘 하나만 남겨 볼까요?\n👉 ${origin}`} />
        <CopyBox title="일요일" text={`이번 주 마지막 날이에요.\n하나만 더 하면 도장인 분들, 오늘 밤까지 남겨 주세요 💮\n👉 ${origin}`} />
      </section>
    </>
  )
}

interface Member { id: string; nickname: string; brand_name: string }
interface CompletionRow { id: string; status: string; completed_on: string | null; requested_at: string; user_id: string; course_id: string; profiles: { nickname: string }; courses: { title: string } }

function Completions() {
  const { toast } = useApp()
  const [busy, run] = useRun()
  const [rows, reload] = useLoad(async () => (await supabase.from('completions').select('*, profiles(nickname), courses(title)').order('requested_at', { ascending: false }).limit(200)).data as unknown as CompletionRow[])
  const [members] = useLoad(async () => (await supabase.from('profiles').select('id,nickname,brand_name').order('nickname')).data as Member[])
  const [courses] = useLoad(async () => (await supabase.from('courses').select('*').eq('kind', 'course').order('sort')).data as Course[])
  const [course, setCourse] = useState('')
  const [date, setDate] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [dates, setDates] = useState<Record<string, string>>({})
  if (!rows || !members || !courses) return <Loading />
  const pending = rows.filter((r) => r.status === 'requested')
  const already = new Set(rows.filter((r) => r.course_id === course && r.status === 'approved').map((r) => r.user_id))

  const decide = (r: CompletionRow, ok: boolean) =>
    run(async () => {
      await rpc('admin_decide_completion', { p_id: r.id, p_approve: ok, p_completed_on: dates[r.id] || r.completed_on || null })
      reload()
      toast(ok ? '수료를 확인했어요. 기념품이 놓였어요.' : '돌려보냈어요.')
    })

  return (
    <>
      <section className="card stack">
        <h2>확인을 기다리는 수료 {pending.length}건</h2>
        {pending.length === 0 && <p className="empty">기다리는 신청이 없어요.</p>}
        <ul className="list">
          {pending.map((r) => (
            <li key={r.id} style={{ flexWrap: 'wrap' }}>
              <span className="txt"><b>{r.profiles.nickname} · {r.courses.title}</b>알린 날 {fmtDay(r.requested_at)}{r.completed_on ? ` · 마친 날 ${fmtFullDay(r.completed_on)}` : ''}</span>
              <input className="input" style={{ width: 170 }} type="date" aria-label="수료한 날" value={dates[r.id] ?? r.completed_on ?? ''} onChange={(e) => setDates({ ...dates, [r.id]: e.target.value })} />
              <button className="btn primary small" disabled={busy} onClick={() => decide(r, true)}>확인</button>
              <button className="btn ghost small" disabled={busy} onClick={() => decide(r, false)}>돌려보내기</button>
            </li>
          ))}
        </ul>
      </section>
      <section className="card stack">
        <h2>한꺼번에 수료 처리</h2>
        <p className="muted small">예전에 강의를 마친 분들께 수료 기념품을 한 번에 드릴 때 써요.</p>
        <label className="field">강의
          <select className="input" value={course} onChange={(e) => { setCourse(e.target.value); setPicked(new Set()) }}>
            <option value="">강의를 골라 주세요</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <label className="field">수료한 날 (비우면 오늘)
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {course && (
          <div className="chips">
            {members.map((m) => {
              const has = already.has(m.id)
              const on = picked.has(m.id)
              return (
                <button key={m.id} className={`chip${on ? ' on' : ''}`} disabled={has} aria-pressed={on}
                  onClick={() => { const n = new Set(picked); if (on) n.delete(m.id); else n.add(m.id); setPicked(n) }}>
                  {m.nickname}{has ? ' (수료)' : ''}
                </button>
              )
            })}
          </div>
        )}
        <button className="btn primary big" disabled={busy || !course || picked.size === 0}
          onClick={() => run(async () => {
            const n = await rpc<number>('admin_grant_completions', { p_course_id: course, p_user_ids: [...picked], p_completed_on: date || null })
            setPicked(new Set())
            reload()
            toast(`${n}명에게 수료 기념품을 드렸어요.`)
          })}>
          {picked.size}명 수료 처리하기
        </button>
      </section>
    </>
  )
}

interface NewsRow { id: string; kind: Parameters<typeof newsInfo>[0]; note: string; url: string | null; photo_path: string | null; consent: boolean; name_display: string; featured_at: string | null; created_at: string; profiles: { nickname: string; brand_name: string }; courses: { title: string } | null }

function NewsAdmin() {
  const { toast } = useApp()
  const [busy, run] = useRun()
  const [rows, reload] = useLoad(async () => (await supabase.from('news').select('*, profiles(nickname,brand_name), courses(title)').is('hidden_at', null).order('created_at', { ascending: false }).limit(100)).data as unknown as NewsRow[])
  if (!rows) return <Loading />
  const nameOf = (n: NewsRow) => (n.name_display === 'real' ? (n.profiles.brand_name || n.profiles.nickname) : n.name_display === 'anon' ? '한 수강생' : n.profiles.nickname)
  const feature = (n: NewsRow, on: boolean) =>
    run(async () => {
      await rpc('admin_feature_news', { p_id: n.id, p_on: on, p_note: null })
      reload()
      toast(on ? '소개 목록에 올렸어요. 별 10개를 드렸어요.' : '소개에서 내렸어요.')
    })
  return (
    <section className="card stack">
      <h2>좋은 소식 {rows.length}건</h2>
      <p className="muted small">"소개해도 좋아요"에 동의한 소식만 소개할 수 있어요. 문구를 복사해 SNS에 쓰세요.</p>
      {rows.length === 0 && <p className="empty">아직 올라온 소식이 없어요.</p>}
      {rows.map((n) => (
        <div key={n.id} className="card tight stack" style={{ background: '#fff', boxShadow: 'none', border: '1.5px solid var(--line)' }}>
          <div className="row between">
            <b>{newsInfo(n.kind).emoji} {n.profiles.nickname} · {newsInfo(n.kind).banner} · {fmtDay(n.created_at)}</b>
            <span className="muted small">{n.consent ? `소개 동의 (${nameOf(n)})` : '소개 동의 안 함'}</span>
          </div>
          <p>{n.note}</p>
          {n.courses && <p className="muted small">도움이 된 강의: {n.courses.title}</p>}
          {n.photo_path && <img src={sharedUrl(n.photo_path)!} alt="" style={{ maxHeight: 180, borderRadius: 12 }} />}
          {n.url && <a href={n.url} target="_blank" rel="noreferrer">{n.url}</a>}
          {n.consent && (
            <>
              <CopyBox title="소개 문구 초안" text={`🎉 ${nameOf(n)}님의 좋은 소식!\n\n"${n.note}"\n\n${n.courses ? `「${n.courses.title}」을 듣고 여기까지 오셨어요. ` : ''}꾸준히 쌓아 온 시간이 만든 결과라 더 기쁩니다. 함께 축하해 주세요 👏`} />
              <button className={`btn ${n.featured_at ? 'ghost' : 'primary'} wide`} disabled={busy} onClick={() => feature(n, !n.featured_at)}>
                {n.featured_at ? '소개에서 내리기' : '소개했어요 (금빛 리본 달아 주기)'}
              </button>
            </>
          )}
        </div>
      ))}
    </section>
  )
}

function Courses() {
  const { toast, fail } = useApp()
  const [busy, run] = useRun()
  const [rows, reload] = useLoad(async () => (await supabase.from('courses').select('*').order('sort').order('title')).data as Course[])
  const [items] = useLoad(async () => (await supabase.from('items').select('*').eq('source', 'reward').order('sort')).data as Item[])
  const [q, setQ] = useState('')
  const [onlyShown, setOnlyShown] = useState(false)
  const [title, setTitle] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  if (!rows || !items) return <Loading />

  const patch = (id: string, v: Partial<Course>) =>
    run(async () => {
      const { error } = await supabase.from('courses').update(v).eq('id', id)
      if (error) return fail(error)
      reload()
    })
  const shown = rows.filter((c) => c.active).length
  const list = rows.filter((c) => (!onlyShown || c.active) && (!q.trim() || c.title.toLowerCase().includes(q.trim().toLowerCase())))

  return (
    <>
      <section className="card stack">
        <div className="row between">
          <h2>눈보라피팅룸 강의 {rows.length}개</h2>
          <span className="muted">수강생에게 보이는 강의 {shown}개</span>
        </div>
        <p className="muted small">체크한 강의만 수강생의 강의실에 보여요. 유료 강의는 회차마다 도장을, 무료특강은 도장 하나를 받아요.</p>
        <input className="input" placeholder="강의 이름으로 찾기" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="check"><input type="checkbox" checked={onlyShown} onChange={(e) => setOnlyShown(e.target.checked)} /><span>보이는 강의만 보기</span></label>
        <ul className="list">
          {list.map((c) => (
            <li key={c.id} style={{ alignItems: 'flex-start' }}>
              <label className="check" style={{ flex: '1 1 220px', padding: 0 }}>
                <input type="checkbox" checked={c.active} disabled={busy} onChange={(e) => patch(c.id, { active: e.target.checked })} aria-label={`${c.title} 수강생에게 보이기`} />
                <span><b style={{ display: 'block' }}>{c.title}</b>
                  <span className="muted small">{c.kind === 'free' ? '무료특강 · 도장 1개' : `유료 강의 · ${c.session_count}강`}{c.stamp_open ? '' : ' · 도장 닫힘'}</span></span>
              </label>
              <button className="btn ghost small" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? '접기' : '자세히'}</button>
              {open === c.id && (
                <div className="stack" style={{ flex: '1 1 100%', gap: 10 }}>
                  <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <button className={`chip${c.kind === 'course' ? ' on' : ''}`} disabled={busy} onClick={() => patch(c.id, { kind: 'course' })}>유료 강의</button>
                    <button className={`chip${c.kind === 'free' ? ' on' : ''}`} disabled={busy} onClick={() => patch(c.id, { kind: 'free', session_count: 1 })}>무료특강</button>
                  </div>
                  {c.kind === 'course' && (
                    <>
                      <div className="row">
                        <span className="grow"><b>모두 몇 강인가요?</b></span>
                        <button className="btn small" disabled={busy || c.session_count <= 1} onClick={() => patch(c.id, { session_count: c.session_count - 1 })} aria-label="한 강 줄이기">−</button>
                        <b style={{ minWidth: 48, textAlign: 'center' }}>{c.session_count}강</b>
                        <button className="btn small" disabled={busy || c.session_count >= 60} onClick={() => patch(c.id, { session_count: c.session_count + 1 })} aria-label="한 강 늘리기">＋</button>
                      </div>
                      <label className="field">수료 기념품
                        <select className="input" value={c.reward_item_id ?? ''} disabled={busy} onChange={(e) => patch(c.id, { reward_item_id: e.target.value || null })}>
                          <option value="">없음</option>
                          {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                      </label>
                    </>
                  )}
                  <label className="check"><input type="checkbox" checked={c.stamp_open} disabled={busy} onChange={(e) => patch(c.id, { stamp_open: e.target.checked })} /><span>지금 도장을 받을 수 있게 열어 두기</span></label>
                </div>
              )}
            </li>
          ))}
          {list.length === 0 && <li><span className="txt">찾는 강의가 없어요.</span></li>}
        </ul>
      </section>
      <section className="card stack">
        <h2>목록에 없는 강의 직접 넣기</h2>
        <p className="muted small">눈보라피팅룸에 새 강의가 생기면 목록을 다시 가져올 수 있어요. 급할 때는 여기서 직접 넣으세요.</p>
        <label className="field">강의 이름
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <button className="btn primary big" disabled={busy || !title.trim()}
          onClick={() => run(async () => {
            const { error } = await supabase.from('courses').insert({ title: title.trim(), kind: title.includes('무료특강') ? 'free' : 'course', session_count: 1, active: false, sort: 0 })
            if (error) return fail(error)
            setTitle('')
            reload()
            toast('강의를 넣었어요. 목록에서 체크하면 수강생에게 보여요.')
          })}>
          넣기
        </button>
      </section>
    </>
  )
}

interface PendingBook { id: string; title: string; stage: string; isbn: string | null; buy_url: string | null; profiles: { nickname: string } }

function Books() {
  const { toast, fail } = useApp()
  const [busy, run] = useRun()
  const [rows, reload] = useLoad(async () => (await supabase.from('books').select('*').order('month', { ascending: false })).data as Book[])
  const [mine, reloadMine] = useLoad(async () => (await supabase.from('my_books').select('*, profiles(nickname)').order('created_at', { ascending: false })).data as unknown as PendingBook[])
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [month, setMonth] = useState('')
  const [pub, setPub] = useState<Record<string, { isbn: string; buy: string }>>({})
  if (!rows || !mine) return <Loading />
  return (
    <>
      <section className="card stack">
        <h2>북클럽 책 추가</h2>
        <label className="field">책 제목<input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="field">지은이<input className="input" value={author} onChange={(e) => setAuthor(e.target.value)} /></label>
        <label className="field">읽는 달<input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
        <button className="btn primary big" disabled={busy || !title.trim()}
          onClick={() => run(async () => {
            const { error } = await supabase.from('books').insert({ title: title.trim(), author: author.trim(), month: month ? `${month}-01` : null })
            if (error) return fail(error)
            setTitle(''); setAuthor('')
            reload()
            toast('책을 추가했어요.')
          })}>
          추가하기
        </button>
        <ul className="list">
          {rows.map((b) => (
            <li key={b.id}>
              <span className="txt"><b>{b.title}</b>{b.author}{b.month ? ` · ${b.month.slice(0, 7)}` : ''}{b.active ? '' : ' · 숨김'}</span>
              <button className="btn ghost small" disabled={busy} onClick={() => run(async () => { await supabase.from('books').update({ active: !b.active }).eq('id', b.id); reload() })}>{b.active ? '숨기기' : '다시 보이기'}</button>
            </li>
          ))}
        </ul>
      </section>
      <section className="card stack">
        <h2>회원이 쓰는 책</h2>
        <p className="muted small">실제로 책이 나온 것을 확인하면 "출간"으로 바꿔 주세요. 쇼윈도에 진열돼요.</p>
        {mine.length === 0 && <p className="empty">아직 없어요.</p>}
        <ul className="list">
          {mine.map((m) => (
            <li key={m.id} style={{ flexWrap: 'wrap' }}>
              <span className="txt"><b>{m.profiles.nickname} · {m.title}</b>{m.stage === 'published' ? `출간${m.isbn ? ` · ISBN ${m.isbn}` : ''}` : `${m.stage} 단계`}</span>
              {m.stage !== 'published' && (
                <>
                  <input className="input" style={{ width: 170 }} placeholder="ISBN (선택)" value={pub[m.id]?.isbn ?? ''} onChange={(e) => setPub({ ...pub, [m.id]: { isbn: e.target.value, buy: pub[m.id]?.buy ?? '' } })} />
                  <input className="input" style={{ width: 220 }} placeholder="책 사는 곳 주소 (선택)" value={pub[m.id]?.buy ?? ''} onChange={(e) => setPub({ ...pub, [m.id]: { buy: e.target.value, isbn: pub[m.id]?.isbn ?? '' } })} />
                  <button className="btn primary small" disabled={busy}
                    onClick={() => run(async () => {
                      await rpc('admin_approve_book', { p_id: m.id, p_isbn: pub[m.id]?.isbn ?? '', p_buy_url: pub[m.id]?.buy ?? '', p_cover_url: '' })
                      reloadMine()
                      toast('출간으로 바꿨어요.')
                    })}>
                    출간 확인
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function Items() {
  const { session, toast, fail } = useApp()
  const [busy, run] = useRun()
  const [rows, reload] = useLoad(async () => (await supabase.from('items').select('*').order('sort')).data as Item[])
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'floor' | 'wall' | 'paint'>('floor')
  const [price, setPrice] = useState(5)
  const [emoji, setEmoji] = useState('')
  const [color, setColor] = useState('#F3C9A5')
  const [file, setFile] = useState<File | null>(null)
  const [reward, setReward] = useState(false)
  const [season, setSeason] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  if (!rows) return <Loading />

  const add = () =>
    run(async () => {
      let image_url: string | null = null
      if (file) {
        // 물건 그림은 투명 배경을 살려야 해서 줄이지 않고 그대로 올린다.
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
        const path = `items/${crypto.randomUUID()}.${ext}`
        const { error } = await supabase.storage.from('shared').upload(path, file, { contentType: file.type })
        if (error) return fail(error)
        image_url = path
      }
      const { error } = await supabase.from('items').insert({
        name: name.trim(), kind: kind === 'paint' ? 'wall_paint' : 'object', slot: kind === 'floor' ? 'floor' : 'wall',
        price: reward ? 0 : price, emoji: emoji.trim() || null, image_url, color: kind === 'paint' ? color : null,
        source: reward ? 'reward' : 'shop', season: season.trim(), sale_start: from || null, sale_end: to || null,
        sort: (rows.at(-1)?.sort ?? 0) + 1,
      })
      if (error) return fail(error)
      setName(''); setEmoji(''); setFile(null)
      reload()
      toast('물건을 추가했어요. 가게에 바로 나와요.')
    })

  void session
  return (
    <>
      <section className="card stack">
        <h2>물건 추가</h2>
        <label className="field">이름<input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} /></label>
        <div className="seg">
          <button className={`chip${kind === 'floor' ? ' on' : ''}`} onClick={() => setKind('floor')}>바닥에 놓는 것</button>
          <button className={`chip${kind === 'wall' ? ' on' : ''}`} onClick={() => setKind('wall')}>벽에 거는 것</button>
          <button className={`chip${kind === 'paint' ? ' on' : ''}`} onClick={() => setKind('paint')}>벽 색</button>
        </div>
        {kind === 'paint' ? (
          <label className="field">색<input className="input" type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
        ) : (
          <>
            <label className="field">그림 (배경이 투명한 그림)
              <input className="input" type="file" accept="image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <label className="field">그림이 없을 때 쓸 임시 그림 글자
              <input className="input" value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="예: 🪴" />
            </label>
          </>
        )}
        <label className="check"><input type="checkbox" checked={reward} onChange={(e) => setReward(e.target.checked)} /><span>가게에서 팔지 않고, 수료·선물로만 주는 물건</span></label>
        {!reward && (
          <>
            <label className="field">값 (별)<input className="input" type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} /></label>
            <label className="field">기간 한정 이름 (선택)<input className="input" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="예: 겨울 한정" /></label>
            <div className="row">
              <label className="field grow">파는 첫날<input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
              <label className="field grow">파는 마지막 날<input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            </div>
          </>
        )}
        <button className="btn primary big" disabled={busy || !name.trim()} onClick={add}>추가하기</button>
      </section>
      <section className="card stack">
        <h2>물건 {rows.length}개</h2>
        <div className="shop-grid">
          {rows.map((it) => (
            <button key={it.id} className="shop-item" style={{ opacity: it.active ? 1 : 0.45 }} disabled={busy}
              onClick={() => run(async () => { await supabase.from('items').update({ active: !it.active }).eq('id', it.id); reload() })}
              aria-label={`${it.name} ${it.active ? '숨기기' : '다시 보이기'}`}>
              <span className="pic">{it.kind === 'wall_paint' ? <i style={{ background: it.color ?? '#fff' }} /> : <Sprite emoji={it.emoji} image={sharedUrl(it.image_url)} label={it.name} />}</span>
              <b>{it.name}</b>
              <span className="price">{it.source === 'reward' ? '얻는 물건' : `⭐ ${it.price}`}</span>
              {it.season && <span className="tag">{it.season}</span>}
              <span className="muted small">{it.active ? '누르면 숨김' : '숨김 · 누르면 보임'}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  )
}

interface Invite { code: string; label: string; role: string; max_uses: number | null; used_count: number; active: boolean }

function Invites() {
  const { toast, fail } = useApp()
  const [busy, run] = useRun()
  const [rows, reload] = useLoad(async () => (await supabase.from('invite_codes').select('*').order('created_at', { ascending: false })).data as Invite[])
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  if (!rows) return <Loading />
  return (
    <section className="card stack">
      <h2>초대 코드</h2>
      <p className="muted small">이 코드를 아는 사람만 마을에 건물을 지을 수 있어요. 단톡방이나 강의에서 알려 주세요.</p>
      <label className="field">새 코드 (영문·숫자, 3자 이상)<input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="예: NFB2026" /></label>
      <label className="field">어디에 쓰는 코드인가요? (메모)<input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="예: 11월 단톡방" /></label>
      <button className="btn primary big" disabled={busy || code.trim().length < 3}
        onClick={() => run(async () => {
          const { error } = await supabase.from('invite_codes').insert({ code: code.trim(), label: label.trim() })
          if (error) return fail(error)
          setCode(''); setLabel('')
          reload()
          toast('코드를 만들었어요.')
        })}>
        코드 만들기
      </button>
      <ul className="list">
        {rows.map((r) => (
          <li key={r.code}>
            <span className="txt"><b>{r.code}{r.role === 'admin' ? ' (관리자용)' : ''}</b>{r.label} · {r.used_count}명 사용{r.active ? '' : ' · 멈춤'}</span>
            <button className="btn ghost small" disabled={busy} onClick={() => run(async () => { await supabase.from('invite_codes').update({ active: !r.active }).eq('code', r.code); reload() })}>{r.active ? '멈추기' : '다시 열기'}</button>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface RecordRow { id: string; url: string | null; note: string; day: string; input_type: string; profiles: { nickname: string } }

function Records() {
  const { toast } = useApp()
  const [busy, run] = useRun()
  const [rows, reload] = useLoad(async () => {
    const { data } = await supabase.from('records').select('id,url,note,day,input_type, profiles(nickname)').is('voided_at', null).order('created_at', { ascending: false }).limit(200)
    // 최근 200건 가운데 아무거나 12건을 뽑아 표본으로 본다.
    return ([...(data ?? [])].sort(() => Math.random() - 0.5).slice(0, 12)) as unknown as RecordRow[]
  })
  if (!rows) return <Loading />
  return (
    <section className="card stack">
      <div className="row between">
        <h2>기록 표본 확인</h2>
        <button className="btn small" onClick={reload}>다른 표본 보기</button>
      </div>
      <p className="muted small">기록은 스스로 남긴 대로 인정해요. 가끔 표본만 보고, 문제가 있는 기록만 무효로 바꿔 주세요.</p>
      {rows.length === 0 && <p className="empty">아직 기록이 없어요.</p>}
      <ul className="list">
        {rows.map((r) => (
          <li key={r.id}>
            <span className="txt"><b>{r.profiles.nickname} · {fmtDay(r.day)}</b>{r.note || (r.input_type === 'url' ? r.url : r.input_type === 'photo' ? '사진으로 남김' : '했어요')}</span>
            {r.url && <a className="btn ghost small" href={r.url} target="_blank" rel="noreferrer">열어 보기</a>}
            <button className="btn ghost small" disabled={busy} onClick={() => run(async () => { await rpc('admin_void_record', { p_record_id: r.id }); reload(); toast('무효로 바꿨어요.') })}>무효</button>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface SettingRow { key: string; value: number; label: string }

function Settings() {
  const { toast, fail } = useApp()
  const [busy, run] = useRun()
  const [rows, reload] = useLoad(async () => (await supabase.from('settings').select('*').order('key')).data as SettingRow[])
  const [edit, setEdit] = useState<Record<string, string>>({})
  if (!rows) return <Loading />
  return (
    <section className="card stack">
      <h2>설정값</h2>
      <p className="muted small">보상 수치는 언제든 바꿀 수 있어요. 바꾼 뒤부터 적용돼요.</p>
      <table className="tbl">
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th>{r.label}</th>
              <td style={{ width: 110 }}><input className="input" type="number" min={0} aria-label={r.label} value={edit[r.key] ?? String(r.value)} onChange={(e) => setEdit({ ...edit, [r.key]: e.target.value })} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn primary big" disabled={busy || Object.keys(edit).length === 0}
        onClick={() => run(async () => {
          for (const [key, v] of Object.entries(edit)) {
            const { error } = await supabase.from('settings').update({ value: Number(v), updated_at: new Date().toISOString() }).eq('key', key)
            if (error) return fail(error)
          }
          setEdit({})
          reload()
          toast('저장했어요.')
        })}>
        저장하기
      </button>
    </section>
  )
}

// 표지·작품 그림을 줄여서 올리고, 저장된 경로를 돌려준다.
async function uploadAdminImage(folder: 'covers' | 'works', file: File): Promise<string> {
  const blob = await shrinkImage(file, 1400)
  const path = `${folder}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('shared').upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return path
}

function ShelfAdmin() {
  const { toast, fail } = useApp()
  const [busy, run] = useRun()
  const [rows, reload] = useLoad(async () => (await supabase.from('shelf_books').select('*').order('category').order('sort').order('created_at')).data as ShelfBook[])
  const [category, setCategory] = useState<string>('essay')
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [buy, setBuy] = useState('')
  const [file, setFile] = useState<File | null>(null)
  if (!rows) return <Loading />
  const floors = SHELF_FLOORS.filter((f) => f.key !== 'club')
  return (
    <>
      <section className="card stack">
        <h2>오브북 도서관에 책 넣기</h2>
        <p className="muted small">북클럽에서 읽은 책은 "책" 탭에서 넣으면 도서관 5층에 함께 보여요.</p>
        <div className="chips" role="radiogroup" aria-label="분류">
          {floors.map((f) => <button key={f.key} className={`chip${category === f.key ? ' on' : ''}`} role="radio" aria-checked={category === f.key} onClick={() => setCategory(f.key)}>{f.label}</button>)}
        </div>
        <label className="field">책 제목<input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} /></label>
        <label className="field">지은이<input className="input" value={author} onChange={(e) => setAuthor(e.target.value)} /></label>
        <label className="field">표지 그림<input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <label className="field">책 사는 곳 주소 (선택)<input className="input" inputMode="url" value={buy} onChange={(e) => setBuy(e.target.value)} placeholder="https://" /></label>
        <button className="btn primary big" disabled={busy || !title.trim()}
          onClick={() => run(async () => {
            const cover = file ? await uploadAdminImage('covers', file) : null
            const { error } = await supabase.from('shelf_books').insert({ category, title: title.trim(), author: author.trim(), cover_url: cover, buy_url: buy.trim() || null, sort: rows.length + 1 })
            if (error) return fail(error)
            setTitle(''); setAuthor(''); setBuy(''); setFile(null)
            reload()
            toast('도서관에 꽂았어요.')
          })}>
          도서관에 꽂기
        </button>
      </section>
      {floors.map((f) => {
        const list = rows.filter((b) => b.category === f.key)
        return (
          <section key={f.key} className="card stack">
            <h2>{f.label} {list.length}권</h2>
            {list.length === 0 && <p className="empty">아직 없어요.</p>}
            <ul className="list">
              {list.map((b) => (
                <li key={b.id}>
                  {b.cover_url ? <img className="thumb" style={{ width: 40, height: 54 }} src={sharedUrl(b.cover_url)!} alt="" /> : <span className="ico" aria-hidden>📕</span>}
                  <span className="txt"><b>{b.title}</b>{b.author}{b.active ? '' : ' · 숨김'}</span>
                  <button className="btn ghost small" disabled={busy} onClick={() => run(async () => { await supabase.from('shelf_books').update({ active: !b.active }).eq('id', b.id); reload() })}>{b.active ? '숨기기' : '다시 보이기'}</button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}

function ExhibitAdmin() {
  const { toast, fail } = useApp()
  const [busy, run] = useRun()
  const [shows, reload] = useLoad(async () => (await supabase.from('exhibitions').select('*').order('round', { ascending: false })).data as Exhibition[])
  const [works, reloadWorks] = useLoad(async () => (await supabase.from('exhibition_works').select('*').order('sort').order('created_at')).data as Work[])
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState('')
  const [note, setNote] = useState('')
  const [target, setTarget] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [artist, setArtist] = useState('')
  if (!shows || !works) return <Loading />
  const nextRound = (shows[0]?.round ?? 0) + 1
  return (
    <>
      <section className="card stack">
        <h2>{nextRound}회 전시 만들기</h2>
        <label className="field">전시 이름<input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} /></label>
        <label className="field">열린 때<input className="input" value={when} onChange={(e) => setWhen(e.target.value)} placeholder="예: 2025년 11월" /></label>
        <label className="field">소개 (선택)<textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></label>
        <button className="btn primary big" disabled={busy || !title.trim()}
          onClick={() => run(async () => {
            const { error } = await supabase.from('exhibitions').insert({ round: nextRound, title: title.trim(), held_on: when.trim(), note: note.trim() })
            if (error) return fail(error)
            setTitle(''); setWhen(''); setNote('')
            reload()
            toast('전시를 만들었어요. 아래에서 작품을 올려 주세요.')
          })}>
          전시 만들기
        </button>
      </section>
      {shows.length > 0 && (
        <section className="card stack">
          <h2>작품 올리기</h2>
          <label className="field">어느 전시인가요?
            <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">전시를 골라 주세요</option>
              {shows.map((s) => <option key={s.id} value={s.id}>{s.round}회 · {s.title}</option>)}
            </select>
          </label>
          <label className="field">작품 그림 (여러 장을 한 번에 고를 수 있어요)
            <input className="input" type="file" accept="image/*" multiple onChange={(e) => setFiles([...(e.target.files ?? [])])} />
          </label>
          <label className="field">작가 이름 (선택, 고른 그림 모두에 붙어요)<input className="input" value={artist} onChange={(e) => setArtist(e.target.value)} maxLength={40} /></label>
          <button className="btn primary big" disabled={busy || !target || files.length === 0}
            onClick={() => run(async () => {
              let n = works.filter((w) => w.exhibition_id === target).length
              for (const f of files) {
                const path = await uploadAdminImage('works', f)
                const { error } = await supabase.from('exhibition_works').insert({ exhibition_id: target, image_url: path, artist: artist.trim(), title: f.name.replace(/\.[^.]+$/, '').slice(0, 80), sort: ++n })
                if (error) return fail(error)
              }
              setFiles([])
              reloadWorks()
              toast(`${files.length}점을 걸었어요.`)
            })}>
            {files.length > 0 ? `${files.length}점 걸기` : '작품 걸기'}
          </button>
        </section>
      )}
      {shows.map((s) => {
        const list = works.filter((w) => w.exhibition_id === s.id)
        return (
          <section key={s.id} className="card stack">
            <div className="row between">
              <h2>{s.round}회 · {s.title}</h2>
              <button className="btn ghost small" disabled={busy} onClick={() => run(async () => { await supabase.from('exhibitions').update({ active: !s.active }).eq('id', s.id); reload() })}>{s.active ? '숨기기' : '다시 보이기'}</button>
            </div>
            <p className="muted small">{s.held_on} · 작품 {list.length}점{s.active ? '' : ' · 숨김'}</p>
            <div className="work-grid">
              {list.map((w) => (
                <div key={w.id} className="work" style={{ cursor: 'default' }}>
                  <img src={sharedUrl(w.image_url)!} alt="" loading="lazy" />
                  <span>{w.title}{w.artist ? ` · ${w.artist}` : ''}</span>
                  <button className="btn ghost small" disabled={busy} onClick={() => run(async () => { await supabase.from('exhibition_works').delete().eq('id', w.id); reloadWorks() })}>내리기</button>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </>
  )
}

// 광장 관리: 단톡방에 올린 글을 모아 두고, 방명록을 살핀다.
function PlazaAdmin() {
  const { toast, fail } = useApp()
  const [busy, run] = useRun()
  const [posts, reload] = useLoad(async () => (await supabase.from('town_posts').select('*').order('posted_on', { ascending: false }).order('created_at', { ascending: false }).limit(200)).data as TownPost[])
  const [notes, reloadNotes] = useLoad(async () => (await supabase.from('plaza_notes').select('id,user_id,note,created_at,hidden_at, profiles(nickname)').order('created_at', { ascending: false }).limit(100)).data as unknown as PlazaNote[])
  const [body, setBody] = useState('')
  const [link, setLink] = useState('')
  const [day, setDay] = useState('')
  const [pinned, setPinned] = useState(false)
  if (!posts || !notes) return <Loading />
  return (
    <>
      <section className="card stack">
        <h2>아디쌤 소식 올리기</h2>
        <p className="muted small">단톡방에 올린 글을 그대로 붙여넣으면 광장에 차곡차곡 쌓여요.</p>
        <label className="field">내용<textarea className="input" style={{ minHeight: 160 }} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} /></label>
        <label className="field">올린 날 (비우면 오늘)<input className="input" type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
        <label className="field">함께 보여줄 주소 (선택)<input className="input" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" /></label>
        <label className="check"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /><span>맨 위에 고정하기</span></label>
        <button className="btn primary big" disabled={busy || !body.trim()}
          onClick={() => run(async () => {
            const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
            const { error } = await supabase.from('town_posts').insert({ body: body.trim(), link: link.trim() || null, posted_on: day || today, pinned })
            if (error) return fail(error)
            setBody(''); setLink(''); setDay(''); setPinned(false)
            reload()
            toast('광장에 올렸어요.')
          })}>
          광장에 올리기
        </button>
      </section>
      <section className="card stack">
        <h2>올린 소식 {posts.length}개</h2>
        {posts.length === 0 && <p className="empty">아직 없어요.</p>}
        {posts.map((p) => (
          <article key={p.id} className="post" style={{ opacity: p.active ? 1 : 0.5 }}>
            <b>{p.pinned ? '📌 ' : ''}{fmtDay(p.posted_on)}{p.active ? '' : ' · 숨김'}</b>
            <p>{p.body.length > 140 ? `${p.body.slice(0, 140)}…` : p.body}</p>
            <div className="row">
              <button className="btn ghost small" disabled={busy} onClick={() => run(async () => { await supabase.from('town_posts').update({ pinned: !p.pinned }).eq('id', p.id); reload() })}>{p.pinned ? '고정 풀기' : '고정하기'}</button>
              <button className="btn ghost small" disabled={busy} onClick={() => run(async () => { await supabase.from('town_posts').update({ active: !p.active }).eq('id', p.id); reload() })}>{p.active ? '숨기기' : '다시 보이기'}</button>
            </div>
          </article>
        ))}
      </section>
      <section className="card stack">
        <h2>방명록 살피기</h2>
        <p className="muted small">문제가 있는 글만 가려 주세요. 가린 글은 다른 회원에게 보이지 않아요.</p>
        {notes.length === 0 && <p className="empty">아직 글이 없어요.</p>}
        <ul className="list">
          {notes.map((n) => (
            <li key={n.id} style={{ opacity: n.hidden_at ? 0.5 : 1 }}>
              <span className="txt"><b>{n.profiles.nickname}님 · {fmtDay(n.created_at)}{n.hidden_at ? ' · 가림' : ''}</b>{n.note}</span>
              {!n.hidden_at && <button className="btn ghost small" disabled={busy} onClick={() => run(async () => { await rpc('remove_plaza_note', { p_id: n.id }); reloadNotes() })}>가리기</button>}
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
