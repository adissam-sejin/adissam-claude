import { useEffect, useState } from 'react'
import { useApp, useRun } from '../ctx'
import { rpc, uploadPhoto, type RecordResult } from '../lib/api'
import type { Floor } from '../lib/types'
import { channelInfo, floorTitle, guessChannel } from '../lib/util'
import { Celebrate, Sheet } from './ui'

type Mode = 'url' | 'photo' | 'check'

// 기록 남기기: 주소 / 사진 / 그냥 했어요 — 어느 쪽이든 똑같이 1건이다.
export function RecordSheet({ floors, floorId, onClose }: { floors: Floor[]; floorId?: string; onClose: () => void }) {
  const { session, reload } = useApp()
  const [busy, run] = useRun()
  const [mode, setMode] = useState<Mode>('url')
  const [fid, setFid] = useState(floorId ?? floors[0]?.id)
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [result, setResult] = useState<RecordResult | null>(null)

  // 주소를 붙여넣으면 어느 채널인지 알아채서 그 층을 골라 준다.
  useEffect(() => {
    if (floorId || !url) return
    const t = guessChannel(url)
    const hit = t && floors.find((f) => f.channel_type === t)
    if (hit) setFid(hit.id)
  }, [url, floors, floorId])

  const save = () =>
    run(async () => {
      let photo: string | null = null
      if (mode === 'photo' && file) photo = await uploadPhoto('proofs', session!.user.id, file)
      const r = await rpc<RecordResult>('add_record', {
        p_floor_id: fid, p_input_type: mode, p_url: mode === 'url' ? url.trim() : null, p_photo_path: photo, p_note: note,
      })
      await reload()
      setResult(r)
    })

  if (result) {
    const left = result.goal - result.week_count
    if (result.stamped) {
      return <Celebrate icon="💮" title="도장 쾅!" lines={['이번 주 목표를 채웠어요.', `별 ${result.bonus + result.stars}개를 받았어요.`]} onDone={onClose} />
    }
    return (
      <Celebrate
        icon={result.stars > 0 ? '⭐' : '📌'}
        title="기록을 남겼어요"
        lines={[
          result.stars > 0 ? `별 ${result.stars}개를 받았어요.` : '오늘 이 층의 별은 이미 받았어요. 기록은 잘 쌓였어요.',
          left > 0 ? (left === 1 ? '하나만 더 하면 이번 주 도장이에요.' : `${left}개 더 하면 이번 주 도장이에요.`) : '이번 주 도장은 이미 받았어요.',
        ]}
        onDone={onClose}
      />
    )
  }

  const canSave = mode === 'url' ? /^https?:\/\//i.test(url.trim()) : mode === 'photo' ? Boolean(file) : true

  return (
    <Sheet title="무엇을 올리셨나요?" onClose={onClose}>
      {floors.length > 1 && !floorId && (
        <div className="chips" role="radiogroup" aria-label="채널 고르기">
          {floors.map((f) => (
            <button key={f.id} className={`chip${fid === f.id ? ' on' : ''}`} onClick={() => setFid(f.id)} role="radio" aria-checked={fid === f.id}>
              <span aria-hidden>{channelInfo(f.channel_type).emoji}</span>{floorTitle(f)}
            </button>
          ))}
        </div>
      )}
      <div className="seg" role="radiogroup" aria-label="남기는 방법">
        <button className={`chip${mode === 'url' ? ' on' : ''}`} onClick={() => setMode('url')} role="radio" aria-checked={mode === 'url'}>주소 붙여넣기</button>
        <button className={`chip${mode === 'photo' ? ' on' : ''}`} onClick={() => setMode('photo')} role="radio" aria-checked={mode === 'photo'}>사진으로 남기기</button>
        <button className={`chip${mode === 'check' ? ' on' : ''}`} onClick={() => setMode('check')} role="radio" aria-checked={mode === 'check'}>그냥 했어요</button>
      </div>
      {mode === 'url' && (
        <label className="field">올린 글의 주소
          <input className="input" inputMode="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
      )}
      {mode === 'photo' && (
        <label className="field">화면을 찍은 사진
          <input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      )}
      {mode === 'check' && <p className="muted">주소나 사진이 없어도 괜찮아요. 한 일을 그대로 남겨 주세요.</p>}
      <label className="field">한 줄 남기기 (선택)
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="예: 오늘 배운 내용으로 글을 썼어요" />
      </label>
      <p className="muted small">남긴 한 줄은 마을 이웃에게 보여요.</p>
      <button className="btn primary big" onClick={save} disabled={busy || !canSave || !fid}>{busy ? '남기는 중…' : '남기기'}</button>
    </Sheet>
  )
}
