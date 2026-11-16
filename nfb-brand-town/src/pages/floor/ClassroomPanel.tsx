import { useEffect, useState } from 'react'
import { useApp, useRun } from '../../ctx'
import { rpc } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import type { Completion, Course } from '../../lib/types'
import { fmtFullDay } from '../../lib/util'
import { Sheet, Sprite } from '../../components/ui'
import { sharedUrl } from '../../lib/supabase'

export default function ClassroomPanel() {
  const { me, reload, toast } = useApp()
  const [busy, run] = useRun()
  const [courses, setCourses] = useState<Course[]>([])
  const [sheet, setSheet] = useState<null | 'pick' | 'done'>(null)
  const [stampFor, setStampFor] = useState<Course | null>(null)
  const [note, setNote] = useState('')
  const [q, setQ] = useState('')
  const [cert, setCert] = useState<Completion | null>(null)
  const [doneCourse, setDoneCourse] = useState('')
  const [doneDate, setDoneDate] = useState('')

  useEffect(() => {
    void supabase.from('courses').select('*').eq('active', true).order('sort').order('title')
      .then(({ data }) => setCourses((data ?? []) as Course[]))
  }, [])
  if (!me) return null

  const progress = new Map(me.courses.map((c) => [c.course_id, c]))
  const waiting = me.courses.filter((c) => c.pending)
  const stamped = me.courses.filter((c) => c.stamps.length > 0)
  // 신청할 수 있는 강의: 도장이 열려 있고, 아직 신청하지도 받지도 않은 것
  const canAsk = courses.filter((c) => c.stamp_open && !progress.get(c.id)?.pending && !progress.get(c.id)?.stamps.length)
  const word = q.trim().toLowerCase()
  const shown = word ? canAsk.filter((c) => c.title.toLowerCase().includes(word)) : canAsk
  const paid = courses.filter((c) => c.kind === 'course')
  const requested = new Set(me.completions.filter((c) => c.status !== 'rejected').map((c) => c.course_id))

  const ask = () =>
    run(async () => {
      await rpc('stamp_lecture', { p_course_id: stampFor!.id, p_note: note })
      await reload()
      setStampFor(null)
      setNote('')
      setSheet(null)
      toast('도장을 신청했어요. 아디쌤이 확인하면 찍혀요.')
    })

  return (
    <>
      <section className="card stack">
        <h2>강의 도장</h2>
        <p className="muted small">강의를 들었다면 도장을 신청해 주세요. 아디쌤이 확인하면 도장이 찍히고 별도 받아요. 강의 하나에 도장 하나예요.</p>
        {waiting.length === 0 && stamped.length === 0 && <p className="empty">아직 받은 도장이 없어요.</p>}
        <ul className="list">
          {waiting.map((c) => (
            <li key={c.course_id}>
              <span className="ico" aria-hidden>⏳</span>
              <span className="txt"><b>{c.title}</b>아디쌤이 확인하고 있어요</span>
              <button className="btn ghost small" disabled={busy}
                onClick={() => run(async () => { await rpc('cancel_lecture_stamp', { p_course_id: c.course_id }); await reload(); toast('신청을 거두었어요.') })}>
                신청 거두기
              </button>
            </li>
          ))}
          {stamped.map((c) => (
            <li key={c.course_id}>
              <span className="ico" aria-hidden>💮</span>
              <span className="txt"><b>{c.title}</b>도장을 받았어요</span>
            </li>
          ))}
        </ul>
        <button className="btn primary wide" onClick={() => { setQ(''); setSheet('pick') }}>도장 신청하기</button>
      </section>

      <section className="card stack">
        <h2>수료 장식장</h2>
        <p className="muted small">강의를 끝까지 마치면 수료 기념품과 수료증을 받아요. 아디쌤이 확인한 뒤에 놓여요.</p>
        {me.completions.length === 0 && <p className="empty">아직 비어 있어요. 예전에 마친 강의도 알릴 수 있어요.</p>}
        <ul className="list">
          {me.completions.map((c) => (
            <li key={c.id}>
              <span className="ico"><Sprite emoji={c.status === 'approved' ? (c.item?.emoji ?? '🎓') : '⏳'} image={c.status === 'approved' ? sharedUrl(c.item?.image_url) : null} /></span>
              <span className="txt">
                <b>{c.title}</b>
                {c.status === 'approved' ? `${fmtFullDay(c.completed_on)} 수료` : c.status === 'requested' ? '아디쌤이 확인하고 있어요' : '확인되지 않았어요. 다시 알릴 수 있어요'}
              </span>
              {c.status === 'approved' && <button className="btn small" onClick={() => setCert(c)}>수료증 보기</button>}
            </li>
          ))}
        </ul>
        <button className="btn wide" onClick={() => setSheet('done')}>수료했어요 알리기</button>
      </section>

      {sheet === 'pick' && !stampFor && (
        <Sheet title="어떤 강의를 들으셨나요?" onClose={() => setSheet(null)}>
          <p className="muted">들은 강의를 눌러 주세요. 아디쌤이 확인한 뒤에 도장이 찍혀요.</p>
          {canAsk.length > 8 && <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="강의 이름으로 찾기" />}
          {canAsk.length === 0 && <p className="empty">지금 신청할 수 있는 강의가 없어요.</p>}
          {canAsk.length > 0 && shown.length === 0 && <p className="empty">찾는 강의가 없어요.</p>}
          <ul className="list">
            {shown.map((c) => (
              <li key={c.id}>
                <span className="ico" aria-hidden>{c.kind === 'free' ? '🎟️' : '📘'}</span>
                <span className="txt"><b>{c.title}</b>{c.kind === 'free' ? '무료특강' : '강의'}</span>
                <button className="btn primary small" onClick={() => setStampFor(c)}>이 강의예요</button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}

      {sheet === 'done' && (
        <Sheet title="수료했어요 알리기" onClose={() => setSheet(null)}>
          <label className="field">마친 강의
            <select className="input" value={doneCourse} onChange={(e) => setDoneCourse(e.target.value)}>
              <option value="">강의를 골라 주세요</option>
              {paid.filter((c) => !requested.has(c.id)).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>
          <label className="field">마친 날 (기억나는 만큼, 비워도 돼요)
            <input className="input" type="date" value={doneDate} onChange={(e) => setDoneDate(e.target.value)} />
          </label>
          <button className="btn primary big" disabled={busy || !doneCourse}
            onClick={() => run(async () => {
              await rpc('request_completion', { p_course_id: doneCourse, p_completed_on: doneDate || null, p_note: '' })
              await reload()
              setDoneCourse('')
              setDoneDate('')
              setSheet(null)
              toast('알렸어요. 아디쌤이 확인하면 기념품이 놓여요.')
            })}>
            알리기
          </button>
        </Sheet>
      )}

      {stampFor && (
        <Sheet title={stampFor.title} onClose={() => setStampFor(null)}>
          <label className="field">배운 점 한 줄 (선택)
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="예: 내 이야기를 먼저 쓰라는 말이 남았어요" />
          </label>
          <button className="btn primary big" disabled={busy} onClick={ask}>도장 신청하기</button>
          <p className="muted small center">아디쌤이 확인하면 도장이 찍히고 별을 받아요.</p>
        </Sheet>
      )}

      {cert && (
        <Sheet title="수료증" onClose={() => setCert(null)}>
          <div className="cert">
            <p className="muted small">제 {String(cert.cert_no).padStart(4, '0')} 호</p>
            <h2>수료증</h2>
            <p className="who">{me.profile.nickname}</p>
            <p>위 사람은 <b>「{cert.title}」</b> 과정을<br />성실히 마쳤기에 이 증서를 드립니다.</p>
            <p>{fmtFullDay(cert.completed_on)}</p>
            <div className="seal">아는<br />디자이너</div>
          </div>
        </Sheet>
      )}
    </>
  )
}
