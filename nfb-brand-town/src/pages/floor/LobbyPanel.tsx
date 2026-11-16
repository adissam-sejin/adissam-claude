import { useEffect, useState } from 'react'
import { useApp, useRun } from '../../ctx'
import { rpc, uploadPhoto } from '../../lib/api'
import { supabase, sharedUrl } from '../../lib/supabase'
import type { Course, MyBook, News, NewsKind, Taste } from '../../lib/types'
import { BOOK_STAGES, NEWS_KINDS, channelInfo, floorNumber, floorTitle, fmtDay, josa, newsInfo } from '../../lib/util'
import { Celebrate, Sheet } from '../../components/ui'
import { EditProfile } from '../MyBuilding'
import { tasteArt, tasteArtByLabel } from '../../lib/rooms'

interface Cat { id: string; label: string; emoji: string; tag: string }

export function TasteChip({ t, onClick }: { t: Taste; onClick?: () => void }) {
  const art = t.kind === 'photo' ? sharedUrl(t.photo_path) : tasteArt(t)
  const body = (
    <>
      {art ? <img src={art} alt="" /> : <span aria-hidden>{t.emoji ?? '📝'}</span>}
      {t.label}
    </>
  )
  const cls = `taste shape-${t.shape}`
  return onClick ? <button className={cls} onClick={onClick}>{body}</button> : <span className={cls}>{body}</span>
}

export default function LobbyPanel() {
  const { me } = useApp()
  const [sheet, setSheet] = useState<null | 'profile' | 'taste' | 'news' | 'book'>(null)
  const [removeT, setRemoveT] = useState<Taste | null>(null)
  const [editNews, setEditNews] = useState<News | null>(null)
  const [editBook, setEditBook] = useState<MyBook | null>(null)
  if (!me) return null
  const p = me.profile
  const sns = me.floors.filter((f) => f.kind === 'sns')

  return (
    <>
      <section className="card stack">
        <h2>간판과 현판</h2>
        <p><b>{p.brand_name || '아직 간판 이름이 없어요'}</b></p>
        <p className="muted">{p.tagline || '나를 소개하는 한 문장을 적어 보세요.'}</p>
        <button className="btn wide" onClick={() => setSheet('profile')}>이름과 브랜드 색 바꾸기</button>
      </section>

      <section className="card stack">
        <h2>층별 안내판</h2>
        <ul className="list">
          {sns.map((f) => (
            <li key={f.id}>
              <span className="ico" aria-hidden>{channelInfo(f.channel_type).emoji}</span>
              <span className="txt"><b>{floorNumber(me.floors, f)} {floorTitle(f)}</b>{f.channel_url || '채널 주소를 넣으면 손님이 찾아갈 수 있어요'}</span>
              {f.channel_url && <a className="btn ghost small" href={f.channel_url} target="_blank" rel="noreferrer">가기</a>}
            </li>
          ))}
          {sns.length === 0 && <li><span className="txt">아직 채널 층이 없어요.</span></li>}
        </ul>
      </section>

      <section className="card stack">
        <div className="row between">
          <h2>좋아하는 것들의 방</h2>
          <span className="muted">{me.taste.length}개</span>
        </div>
        <p className="muted small">이곳만큼은 좋아하는 것으로 가득 채워 보세요. 별이 들지 않아요.</p>
        {me.taste.length === 0 ? <p className="empty">아직 비어 있어요. 좋아하는 것 하나부터 놓아 보세요.</p> : (
          <div className="taste-wall">
            {me.taste.map((t) => <TasteChip key={t.id} t={t} onClick={() => setRemoveT(t)} />)}
          </div>
        )}
        <button className="btn primary big" onClick={() => setSheet('taste')}>좋아하는 것 넣기</button>
      </section>

      <section className="card stack">
        <h2>좋은 소식 벽</h2>
        <p className="muted small">브랜딩 활동으로 생긴 좋은 일을 자랑해 주세요. 건물에 2주 동안 현수막이 걸려요.</p>
        {me.news.length === 0 && <p className="empty">아직 걸린 소식이 없어요.</p>}
        <ul className="list">
          {me.news.map((n) => (
            <li key={n.id}>
              <span className="ico" aria-hidden>{newsInfo(n.kind).emoji}</span>
              <span className="txt">
                <b>{newsInfo(n.kind).banner} · {fmtDay(n.created_at)}{n.featured ? ' · 🎀 아디쌤이 소개했어요' : ''}</b>
                {n.note}
              </span>
              <button className="btn ghost small" onClick={() => setEditNews(n)}>설정</button>
            </li>
          ))}
        </ul>
        <button className="btn primary big" onClick={() => setSheet('news')}>좋은 소식 알리기</button>
      </section>

      <section className="card stack">
        <h2>쇼윈도 — 내 책</h2>
        <p className="muted small">책을 쓰기 시작하면 쇼윈도에 자리가 생기고, 단계가 나아갈수록 책이 또렷해져요.</p>
        <ul className="list">
          {me.my_books.map((b) => (
            <li key={b.id}>
              <span className="ico" aria-hidden>{b.stage === 'published' ? '📕' : '📝'}</span>
              <span className="txt">
                <b>{b.title}</b>
                {BOOK_STAGES.find((s) => s.stage === b.stage)?.label} 단계{b.isbn ? ` · ISBN ${b.isbn}` : ''}
              </span>
              {b.stage === 'published'
                ? (b.buy_url && <a className="btn small" href={b.buy_url} target="_blank" rel="noreferrer">책 보러 가기</a>)
                : <button className="btn ghost small" onClick={() => setEditBook(b)}>단계 바꾸기</button>}
            </li>
          ))}
        </ul>
        <button className="btn wide" onClick={() => setSheet('book')}>책 쓰기 시작</button>
      </section>

      {sheet === 'profile' && <EditProfile onClose={() => setSheet(null)} />}
      {sheet === 'taste' && <AddTaste onClose={() => setSheet(null)} />}
      {sheet === 'news' && <PostNews onClose={() => setSheet(null)} />}
      {(sheet === 'book' || editBook) && <BookSheet book={editBook} onClose={() => { setSheet(null); setEditBook(null) }} />}
      {removeT && <RemoveTaste t={removeT} onClose={() => setRemoveT(null)} />}
      {editNews && <NewsSettings n={editNews} onClose={() => setEditNews(null)} />}
    </>
  )
}

function RemoveTaste({ t, onClose }: { t: Taste; onClose: () => void }) {
  const { reload } = useApp()
  const [busy, run] = useRun()
  return (
    <Sheet title="이 물건을 치울까요?" onClose={onClose}>
      <div className="center"><TasteChip t={t} /></div>
      <button className="btn primary big" disabled={busy} onClick={() => run(async () => { await rpc('remove_taste', { p_id: t.id }); await reload(); onClose() })}>치우기</button>
      <button className="btn ghost wide" onClick={onClose}>그대로 두기</button>
    </Sheet>
  )
}

function AddTaste({ onClose }: { onClose: () => void }) {
  const { me, session, reload, toast } = useApp()
  const [busy, run] = useRun()
  const [tab, setTab] = useState<'pick' | 'text' | 'photo'>('pick')
  const [cats, setCats] = useState<Cat[]>([])
  const [shape, setShape] = useState<'book' | 'record' | 'note'>('book')
  const [label, setLabel] = useState('')
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    void supabase.from('taste_catalog').select('*').order('sort').then(({ data }) => setCats((data ?? []) as Cat[]))
  }, [])
  const have = new Set(me!.taste.filter((t) => t.kind === 'pick').map((t) => t.label))
  const tags = [...new Set(cats.map((c) => c.tag))]

  const add = (args: Record<string, unknown>, msg: string) =>
    run(async () => {
      await rpc('add_taste', args)
      await reload()
      toast(msg)
    })

  return (
    <Sheet title="좋아하는 것 넣기" onClose={onClose}>
      <div className="seg" role="tablist">
        <button className={`chip${tab === 'pick' ? ' on' : ''}`} role="tab" aria-selected={tab === 'pick'} onClick={() => setTab('pick')}>고르기</button>
        <button className={`chip${tab === 'text' ? ' on' : ''}`} role="tab" aria-selected={tab === 'text'} onClick={() => setTab('text')}>글로 쓰기</button>
        <button className={`chip${tab === 'photo' ? ' on' : ''}`} role="tab" aria-selected={tab === 'photo'} onClick={() => setTab('photo')}>사진 올리기</button>
      </div>
      {tab === 'pick' && tags.map((tag) => (
        <div key={tag} className="stack" style={{ gap: 8 }}>
          <h3>{tag}</h3>
          <div className="chips">
            {cats.filter((c) => c.tag === tag).map((c) => (
              <button key={c.id} className={`chip${have.has(c.label) ? ' on' : ''}`} disabled={busy || have.has(c.label)}
                onClick={() => add({ p_kind: 'pick', p_shape: 'object', p_label: c.label, p_emoji: c.emoji }, `${josa(c.label, '을', '를')} 놓았어요.`)}>
                {tasteArtByLabel(c.label) ? <img className="chip-art" src={tasteArtByLabel(c.label)!} alt="" /> : <span aria-hidden>{c.emoji}</span>}{c.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      {tab === 'text' && (
        <>
          <div className="seg" role="radiogroup" aria-label="무엇을 적을까요">
            <button className={`chip${shape === 'book' ? ' on' : ''}`} role="radio" aria-checked={shape === 'book'} onClick={() => setShape('book')}>📕 책</button>
            <button className={`chip${shape === 'record' ? ' on' : ''}`} role="radio" aria-checked={shape === 'record'} onClick={() => setShape('record')}>💿 노래</button>
            <button className={`chip${shape === 'note' ? ' on' : ''}`} role="radio" aria-checked={shape === 'note'} onClick={() => setShape('note')}>📝 문장</button>
          </div>
          <label className="field">{shape === 'book' ? '좋아하는 책 제목' : shape === 'record' ? '좋아하는 노래' : '좋아하는 문장'}
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
          </label>
          <button className="btn primary big" disabled={busy || !label.trim()}
            onClick={() => add({ p_kind: 'text', p_shape: shape, p_label: label.trim() }, '방에 놓았어요.').then(() => setLabel(''))}>
            방에 놓기
          </button>
        </>
      )}
      {tab === 'photo' && (
        <>
          <label className="field">좋아하는 것의 사진
            <input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <label className="field">무엇인가요? (선택)
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
          </label>
          <p className="muted small">올린 사진은 내 건물을 보는 사람에게 보여요.</p>
          <button className="btn primary big" disabled={busy || !file}
            onClick={() => run(async () => {
              const path = await uploadPhoto('shared', session!.user.id, file!)
              await rpc('add_taste', { p_kind: 'photo', p_shape: 'photo', p_label: label.trim(), p_photo_path: path })
              await reload()
              setFile(null)
              setLabel('')
              toast('액자로 걸었어요.')
            })}>
            액자로 걸기
          </button>
        </>
      )}
    </Sheet>
  )
}

function PostNews({ onClose }: { onClose: () => void }) {
  const { session, reload } = useApp()
  const [busy, run] = useRun()
  const [kind, setKind] = useState<NewsKind | null>(null)
  const [note, setNote] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [course, setCourse] = useState('')
  const [consent, setConsent] = useState(false)
  const [nameDisplay, setNameDisplay] = useState<'real' | 'nick' | 'anon'>('nick')
  const [courses, setCourses] = useState<Course[]>([])
  const [done, setDone] = useState(false)

  useEffect(() => {
    void supabase.from('courses').select('*').eq('kind', 'course').order('sort').then(({ data }) => setCourses((data ?? []) as Course[]))
  }, [])

  if (done) return <Celebrate icon="🎉" title="축하해요!" lines={['건물에 현수막을 걸었어요.', '이웃들이 축하하러 올 거예요.']} onDone={onClose} />

  return (
    <Sheet title="좋은 소식 알리기" onClose={onClose}>
      <div className="pick-grid">
        {NEWS_KINDS.map((k) => (
          <button key={k.kind} className={`pick${kind === k.kind ? ' on' : ''}`} onClick={() => setKind(k.kind)} aria-pressed={kind === k.kind}>
            <span aria-hidden>{k.emoji}</span>{k.label}
          </button>
        ))}
      </div>
      <label className="field">어떤 일이 있었나요?
        <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="예: 도서관에서 처음으로 강의를 했어요!" />
      </label>
      <label className="field">관련 주소 (선택)
        <input className="input" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
      </label>
      <label className="field">사진 (선택)
        <input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {courses.length > 0 && (
        <label className="field">도움이 된 강의 (선택)
          <select className="input" value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="">고르지 않음</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
      )}
      <label className="check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>아디쌤이 이 소식을 밖에 소개해도 좋아요 <span className="muted small">(언제든 바꿀 수 있어요)</span></span>
      </label>
      {consent && (
        <div className="seg" role="radiogroup" aria-label="소개할 때 이름">
          <button className={`chip${nameDisplay === 'real' ? ' on' : ''}`} role="radio" aria-checked={nameDisplay === 'real'} onClick={() => setNameDisplay('real')}>브랜드 이름으로</button>
          <button className={`chip${nameDisplay === 'nick' ? ' on' : ''}`} role="radio" aria-checked={nameDisplay === 'nick'} onClick={() => setNameDisplay('nick')}>마을 이름으로</button>
          <button className={`chip${nameDisplay === 'anon' ? ' on' : ''}`} role="radio" aria-checked={nameDisplay === 'anon'} onClick={() => setNameDisplay('anon')}>이름 없이</button>
        </div>
      )}
      <button className="btn primary big" disabled={busy || !kind || !note.trim()}
        onClick={() => run(async () => {
          const photo = file ? await uploadPhoto('shared', session!.user.id, file) : null
          await rpc('post_news', {
            p_kind: kind, p_note: note.trim(), p_url: url, p_photo_path: photo,
            p_course_id: course || null, p_consent: consent, p_name_display: nameDisplay,
          })
          await reload()
          setDone(true)
        })}>
        현수막 걸기
      </button>
    </Sheet>
  )
}

function NewsSettings({ n, onClose }: { n: News; onClose: () => void }) {
  const { reload, toast } = useApp()
  const [busy, run] = useRun()
  const [consent, setConsent] = useState(Boolean(n.consent))
  const [nameDisplay, setNameDisplay] = useState<'real' | 'nick' | 'anon'>(n.name_display ?? 'nick')
  const save = (hidden: boolean) =>
    run(async () => {
      await rpc('update_news', { p_id: n.id, p_consent: consent, p_name_display: nameDisplay, p_hidden: hidden })
      await reload()
      toast(hidden ? '소식을 내렸어요.' : '바꿨어요.')
      onClose()
    })
  return (
    <Sheet title="소식 설정" onClose={onClose}>
      <p>{n.note}</p>
      <label className="check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>아디쌤이 이 소식을 밖에 소개해도 좋아요</span>
      </label>
      {consent && (
        <div className="seg" role="radiogroup" aria-label="소개할 때 이름">
          <button className={`chip${nameDisplay === 'real' ? ' on' : ''}`} role="radio" aria-checked={nameDisplay === 'real'} onClick={() => setNameDisplay('real')}>브랜드 이름으로</button>
          <button className={`chip${nameDisplay === 'nick' ? ' on' : ''}`} role="radio" aria-checked={nameDisplay === 'nick'} onClick={() => setNameDisplay('nick')}>마을 이름으로</button>
          <button className={`chip${nameDisplay === 'anon' ? ' on' : ''}`} role="radio" aria-checked={nameDisplay === 'anon'} onClick={() => setNameDisplay('anon')}>이름 없이</button>
        </div>
      )}
      <button className="btn primary big" disabled={busy} onClick={() => save(false)}>저장하기</button>
      <button className="btn ghost wide" disabled={busy} onClick={() => save(true)}>이 소식 내리기</button>
    </Sheet>
  )
}

function BookSheet({ book, onClose }: { book: MyBook | null; onClose: () => void }) {
  const { reload, toast } = useApp()
  const [busy, run] = useRun()
  const [title, setTitle] = useState(book?.title ?? '')
  const [stage, setStage] = useState(book?.stage ?? 'plan')
  return (
    <Sheet title={book ? '책 단계 바꾸기' : '책 쓰기 시작'} onClose={onClose}>
      <label className="field">책 제목 (정해지지 않았다면 가제목)
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
      </label>
      <div className="field">지금 어디까지 왔나요?
        <div className="chips" role="radiogroup">
          {BOOK_STAGES.filter((s) => s.stage !== 'published').map((s) => (
            <button key={s.stage} className={`chip${stage === s.stage ? ' on' : ''}`} role="radio" aria-checked={stage === s.stage} onClick={() => setStage(s.stage as MyBook['stage'])}>{s.label}</button>
          ))}
        </div>
      </div>
      <p className="muted small">책이 실제로 나오면 아디쌤이 확인한 뒤 "출간"으로 바뀌고 쇼윈도에 진열돼요.</p>
      <button className="btn primary big" disabled={busy || !title.trim()}
        onClick={() => run(async () => {
          await rpc('save_my_book', { p_id: book?.id ?? null, p_title: title, p_stage: stage })
          await reload()
          toast('쇼윈도에 반영했어요.')
          onClose()
        })}>
        저장하기
      </button>
    </Sheet>
  )
}
