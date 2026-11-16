import { useState } from 'react'
import { useApp } from '../ctx'
import { rpc } from '../lib/api'
import { BRAND_COLORS, CHANNELS } from '../lib/util'
import type { ChannelType } from '../lib/types'
import { MiniBuilding } from '../components/Building'
import { Celebrate } from '../components/ui'

// 한 화면에 한 가지만 묻는다.
export default function Onboard() {
  const { reload, fail, signOut } = useApp()
  const [step, setStep] = useState(0)
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [brand, setBrand] = useState('')
  const [color, setColor] = useState(BRAND_COLORS[0].hex)
  const [channel, setChannel] = useState<ChannelType | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const next = () => setStep((s) => s + 1)
  const back = () => setStep((s) => Math.max(0, s - 1))

  const finish = async () => {
    setBusy(true)
    try {
      await rpc('join_town', {
        p_code: code, p_nickname: nickname.trim(), p_brand_name: brand.trim(), p_brand_color: color,
        p_channel_type: channel, p_channel_name: '', p_channel_url: '',
      })
      setDone(true)
    } catch (e) {
      fail(e)
      if ((e as { code?: string }).code === 'BAD_CODE') setStep(0)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <Celebrate icon="🏠" title="내 건물이 생겼어요!" lines={['환영하는 마음으로 별 5개를 드려요.', '기록을 남길수록 건물이 자라요.']} onDone={() => void reload()} />
    )
  }

  const preview = (
    <div style={{ width: 130, margin: '0 auto' }}>
      <MiniBuilding t={{ id: 'p', nickname, brand_name: brand, brand_color: color, plot_no: 0, week_count: 0, banner: null, cheered_today: false,
        floors: [{ kind: 'lobby', channel_type: null, wall_color: null }, { kind: 'classroom', channel_type: null, wall_color: null }, { kind: 'library', channel_type: null, wall_color: null }, { kind: 'sns', channel_type: 'blog', wall_color: null }] }} />
    </div>
  )

  return (
    <div className="start">
      <p className="steps">{step + 1} / 5</p>
      {step === 0 && (
        <div className="card stack">
          <h2>초대 코드를 넣어 주세요</h2>
          <p className="muted">아디쌤에게 받은 초대 코드예요.</p>
          <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="초대 코드" autoCapitalize="characters" autoFocus />
          <button className="btn primary big" disabled={code.trim().length < 3} onClick={next}>다음</button>
          <button className="btn ghost small" onClick={() => void signOut()}>처음 화면으로</button>
        </div>
      )}
      {step === 1 && (
        <div className="card stack">
          <h2>마을에서 불릴 이름을 알려 주세요</h2>
          <p className="muted">이름이나 별명, 어느 쪽이든 좋아요. 나중에 바꿀 수 있어요.</p>
          <input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="예: 세진" maxLength={20} autoFocus />
          <button className="btn primary big" disabled={!nickname.trim()} onClick={next}>다음</button>
          <button className="btn ghost small" onClick={back}>이전</button>
        </div>
      )}
      {step === 2 && (
        <div className="card stack">
          <h2>건물 간판에 적을 이름을 정해 주세요</h2>
          <p className="muted">내 브랜드 이름이에요. 아직 없다면 비워 두셔도 돼요.</p>
          <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="예: 세진 디자인 공방" maxLength={30} autoFocus />
          <button className="btn primary big" onClick={next}>다음</button>
          <button className="btn ghost small" onClick={back}>이전</button>
        </div>
      )}
      {step === 3 && (
        <div className="card stack">
          <h2>내 브랜드 색을 골라 주세요</h2>
          <p className="muted">지붕과 문, 깃발이 이 색으로 칠해져요. 나중에 바꿀 수 있어요.</p>
          {preview}
          <div className="swatches">
            {BRAND_COLORS.map((c) => (
              <button key={c.hex} className={`swatch${color === c.hex ? ' on' : ''}`} style={{ background: c.hex }} onClick={() => setColor(c.hex)} aria-label={c.name} aria-pressed={color === c.hex} />
            ))}
          </div>
          <button className="btn primary big" onClick={next}>다음</button>
          <button className="btn ghost small" onClick={back}>이전</button>
        </div>
      )}
      {step === 4 && (
        <div className="card stack">
          <h2>먼저 키울 채널을 하나 골라 주세요</h2>
          <p className="muted">고른 채널이 건물의 한 층이 돼요. 다른 채널은 나중에 층을 올릴 수 있어요.</p>
          <div className="pick-grid">
            {CHANNELS.map((c) => (
              <button key={c.type} className={`pick${channel === c.type ? ' on' : ''}`} onClick={() => setChannel(c.type)} aria-pressed={channel === c.type}>
                <span aria-hidden>{c.emoji}</span>{c.name}<small>{c.room}</small>
              </button>
            ))}
          </div>
          <button className="btn primary big" disabled={!channel || busy} onClick={finish}>내 건물 짓기</button>
          <button className="btn ghost small" onClick={back}>이전</button>
        </div>
      )}
    </div>
  )
}
