import { useEffect, useState } from 'react'
import { useApp, useRun } from '../../ctx'
import { rpc } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import type { Floor, RecordLite } from '../../lib/types'
import { channelInfo, fmtDay } from '../../lib/util'
import { RecordSheet } from '../../components/RecordSheet'
import { Sheet } from '../../components/ui'

export default function SnsPanel({ f }: { f: Floor }) {
  const { me, reload, toast } = useApp()
  const [busy, run] = useRun()
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState(f.channel_name)
  const [url, setUrl] = useState(f.channel_url)
  const [rows, setRows] = useState<RecordLite[] | null>(null)
  const info = channelInfo(f.channel_type)

  useEffect(() => {
    void supabase.from('records').select('id,url,note,day,input_type').eq('floor_id', f.id).is('voided_at', null)
      .order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setRows((data ?? []) as RecordLite[]))
  }, [f.id, me])

  const books = Math.floor(f.record_count / 10)
  return (
    <>
      <section className="card stack">
        <div className="row">
          <span style={{ fontSize: '2rem' }} aria-hidden>{info.emoji}</span>
          <div className="grow">
            <b>{f.channel_name || info.name}</b>
            <div className="muted small">{info.room}</div>
          </div>
          {f.channel_url && <a className="btn small" href={f.channel_url} target="_blank" rel="noreferrer">채널 가기</a>}
        </div>
        <button className="btn primary big" onClick={() => setOpen(true)}>기록 남기기</button>
        <button className="btn ghost small" onClick={() => setEdit(true)}>채널 이름과 주소 바꾸기</button>
      </section>
      <section className="card stack">
        <div className="row between">
          <h2>모아보기</h2>
          <span className="muted">기록 {f.record_count}개{books > 0 ? ` · 스크랩북 ${books}권` : ''}</span>
        </div>
        <p className="muted small">기록 10개가 모이면 스크랩북 한 권으로 묶여 방에 꽂혀요.</p>
        {rows && rows.length === 0 && <p className="empty">아직 비어 있어요. 첫 기록을 남겨 보세요.</p>}
        <ul className="list">
          {(rows ?? []).map((r) => (
            <li key={r.id}>
              <span className="ico" aria-hidden>{r.input_type === 'url' ? '🔗' : r.input_type === 'photo' ? '🖼️' : '✅'}</span>
              <span className="txt">
                <b>{fmtDay(r.day)}</b>
                {r.note || (r.input_type === 'url' ? '주소로 남김' : r.input_type === 'photo' ? '사진으로 남김' : '했어요')}
              </span>
              {r.url && <a className="btn ghost small" href={r.url} target="_blank" rel="noreferrer">글 보기</a>}
            </li>
          ))}
        </ul>
      </section>
      {open && <RecordSheet floors={[f]} floorId={f.id} onClose={() => setOpen(false)} />}
      {edit && (
        <Sheet title="채널 이름과 주소" onClose={() => setEdit(false)}>
          <label className="field">층 이름
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder={info.name} />
          </label>
          <label className="field">채널 주소
            <input className="input" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          </label>
          <p className="muted small">채널 주소는 1층 안내판과 공개 건물에 보여요.</p>
          <button className="btn primary big" disabled={busy}
            onClick={() => run(async () => {
              await rpc('update_floor_channel', { p_floor_id: f.id, p_channel_name: name, p_channel_url: url })
              await reload()
              toast('바꿨어요.')
              setEdit(false)
            })}>
            저장하기
          </button>
        </Sheet>
      )}
    </>
  )
}
