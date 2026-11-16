import { useEffect, useState } from 'react'
import { useApp, useRun } from '../../ctx'
import { rpc } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import type { Book } from '../../lib/types'
import { Celebrate, Sheet } from '../../components/ui'

export default function LibraryPanel() {
  const { me, reload } = useApp()
  const [busy, run] = useRun()
  const [books, setBooks] = useState<Book[] | null>(null)
  const [pick, setPick] = useState<Book | null>(null)
  const [note, setNote] = useState('')
  const [attended, setAttended] = useState(false)
  const [got, setGot] = useState<number | null>(null)

  useEffect(() => {
    void supabase.from('books').select('*').eq('active', true).order('month', { ascending: false })
      .then(({ data }) => setBooks((data ?? []) as Book[]))
  }, [])
  if (!me) return null
  const read = new Map(me.readings.map((r) => [r.book_id, r]))

  return (
    <>
      <section className="card stack">
        <div className="row between">
          <h2>북클럽 책</h2>
          <span className="muted">읽은 책 {me.readings.length}권</span>
        </div>
        <p className="muted small">읽은 책을 기록하면 책장에 한 권씩 꽂혀요.</p>
        {books && books.length === 0 && <p className="empty">아직 등록된 북클럽 책이 없어요.</p>}
        <ul className="list">
          {(books ?? []).map((b) => {
            const r = read.get(b.id)
            return (
              <li key={b.id}>
                <span className="ico" aria-hidden>{r ? '📗' : '📖'}</span>
                <span className="txt">
                  <b>{b.title}</b>
                  {r ? (r.note || '읽었어요') : b.author}
                </span>
                <button className={`btn small${r ? '' : ' primary'}`}
                  onClick={() => { setPick(b); setNote(r?.note ?? ''); setAttended(r?.attended ?? false) }}>
                  {r ? '고치기' : '읽었어요'}
                </button>
              </li>
            )
          })}
        </ul>
      </section>
      {pick && (
        <Sheet title={pick.title} onClose={() => setPick(null)}>
          <label className="field">한 줄 기록 (선택)
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="예: 나를 먼저 디자인하라는 말이 좋았어요" />
          </label>
          <label className="check">
            <input type="checkbox" checked={attended} onChange={(e) => setAttended(e.target.checked)} />
            <span>북클럽 모임에도 참여했어요</span>
          </label>
          <button className="btn primary big" disabled={busy}
            onClick={() => run(async () => {
              const r = await rpc<{ stars: number }>('add_reading', { p_book_id: pick.id, p_note: note, p_attended: attended })
              await reload()
              setPick(null)
              if (r.stars > 0) setGot(r.stars)
            })}>
            책장에 꽂기
          </button>
        </Sheet>
      )}
      {got !== null && <Celebrate icon="📗" title="책장에 꽂았어요" lines={[`별 ${got}개를 받았어요.`]} onDone={() => setGot(null)} />}
    </>
  )
}
