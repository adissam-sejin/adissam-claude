import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp, useRun } from '../ctx'
import { rpc } from '../lib/api'
import { supabase } from '../lib/supabase'
import { BuildingView } from '../components/Building'
import { RecordSheet } from '../components/RecordSheet'
import { channelInfo, floorTitle, fmtDay } from '../lib/util'

export default function TodayPage() {
  const { me, today, reload, toast } = useApp()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
  const [busy, run] = useRun()
  if (!me || !today) return null

  const sns = me.floors.filter((f) => f.kind === 'sns')
  const { count, goal, stamped } = me.week
  const left = goal - count
  const line = stamped
    ? '이번 주 도장을 받았어요. 정말 잘하셨어요!'
    : count === 0
      ? '이번 주 첫 기록을 남겨 볼까요?'
      : left === 1
        ? `이번 주 ${count}개 올리셨어요. 하나만 더 하면 도장이에요.`
        : `이번 주 ${count}개 올리셨어요. ${left}개 더 하면 도장이에요.`

  const undo = (id: string) =>
    run(async () => {
      await rpc('undo_record', { p_record_id: id })
      await reload()
      toast('기록을 되돌렸어요.')
    })

  const setGoal = (n: number) =>
    run(async () => {
      await supabase.from('profiles').update({ weekly_goal: n }).eq('id', me.profile.id)
      await reload()
      setGoalOpen(false)
    })

  return (
    <div className="split">
      <div className="sticky">
        <BuildingView b={me} onFloor={(f) => nav(`/floor/${f.id}`)} />
      </div>
      <div className="stack first-mobile">
        <section className="card stack">
          <h1>{me.profile.nickname}님, 반가워요</h1>
          <p style={{ fontSize: '1.15rem', fontWeight: 700 }}>{line}</p>
          <div className="dots" aria-label={`이번 주 ${count}개, 목표 ${goal}개`}>
            {Array.from({ length: Math.max(goal, count) }, (_, i) => (
              <span key={i} className={`dot${i < count ? ' on' : ''}`} aria-hidden>{i < count ? '✍️' : ''}</span>
            ))}
          </div>
          {sns.length > 0 ? (
            <button className="btn primary big" onClick={() => setOpen(true)}>기록 남기기</button>
          ) : (
            <button className="btn primary big" onClick={() => nav('/building')}>먼저 채널 층을 올려 주세요</button>
          )}
          <div className="row between">
            <span className="muted">주간 목표: 일주일에 {goal}개</span>
            <button className="btn ghost small" onClick={() => setGoalOpen((v) => !v)}>목표 바꾸기</button>
          </div>
          {goalOpen && (
            <div className="chips">
              {[2, 3, 5].map((n) => (
                <button key={n} className={`chip${goal === n ? ' on' : ''}`} disabled={busy} onClick={() => setGoal(n)}>일주일에 {n}개</button>
              ))}
            </div>
          )}
        </section>

        {today.recent_cheers.length > 0 && (
          <section className="card tight">
            <p><span aria-hidden>💐</span> {today.recent_cheers.slice(0, 3).map((c) => `${c.from}님`).join(', ')}이 응원했어요.</p>
          </section>
        )}

        <section className="card stack">
          <h2>이번 주에 남긴 기록</h2>
          {today.week_records.length === 0 ? (
            <p className="empty">아직 비어 있어요. 작은 것 하나부터 남겨 보세요.</p>
          ) : (
            <ul className="list">
              {today.week_records.map((r) => {
                const f = me.floors.find((x) => x.id === r.floor_id)
                return (
                  <li key={r.id}>
                    <span className="ico" aria-hidden>{f ? channelInfo(f.channel_type).emoji : '📌'}</span>
                    <span className="txt">
                      <b>{f ? floorTitle(f) : ''} · {fmtDay(r.day)}{r.starred ? ' · ⭐' : ''}</b>
                      {r.note || (r.input_type === 'url' ? r.url : r.input_type === 'photo' ? '사진으로 남김' : '했어요')}
                    </span>
                    <button className="btn ghost small" onClick={() => undo(r.id)} disabled={busy}>되돌리기</button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="card stack">
          <div className="row between">
            <h2>도장판</h2>
            <span className="muted">지금까지 {today.stamp_weeks.length}개</span>
          </div>
          <div className="stampcard">
            {Array.from({ length: Math.max(8, Math.ceil((today.stamp_weeks.length + 1) / 8) * 8) }, (_, i) => (
              <span key={i} className={`stamp${i < today.stamp_weeks.length ? ' on' : ''}`}>{i < today.stamp_weeks.length ? '잘했어요' : i + 1}</span>
            ))}
          </div>
          <p className="muted small">일주일 목표를 채우면 도장 하나와 별 5개를 받아요.</p>
        </section>
      </div>
      {open && <RecordSheet floors={sns} onClose={() => setOpen(false)} />}
    </div>
  )
}
