import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp, useRun } from '../ctx'
import { rpc, removeMemberFiles } from '../lib/api'
import { supabase } from '../lib/supabase'
import { BuildingView } from '../components/Building'
import { Celebrate, Sheet } from '../components/ui'
import { BRAND_COLORS, CHANNELS } from '../lib/util'
import { PhotoSheet } from '../components/PhotoSheet'
import type { ChannelType } from '../lib/types'

export default function MyBuilding() {
  const { me, signOut } = useApp()
  const nav = useNavigate()
  const [sheet, setSheet] = useState<null | 'floor' | 'edit' | 'share' | 'photo' | 'leave'>(null)
  if (!me) return null
  const p = me.profile

  return (
    <div className="split">
      <div className="sticky">
        <BuildingView b={me} onFloor={(f) => nav(`/floor/${f.id}`)} />
      </div>
      <div className="stack">
        <section className="card stack">
          <h1>{p.brand_name || `${p.nickname}님의 건물`}</h1>
          {p.tagline && <p>{p.tagline}</p>}
          <div className="kv">
            <span>도장 {me.stamps}개</span>
            <span>기록 {me.records}개</span>
            <span>모은 별 {me.stars_earned}개</span>
            <span>받은 응원 {me.cheers}번</span>
          </div>
          <p className="muted">층을 누르면 방으로 들어가 꾸밀 수 있어요. 모은 별은 건물 위 밤하늘에 떠요.</p>
        </section>
        <section className="card stack">
          <button className="btn primary big" onClick={() => setSheet('photo')}>📸 건물 인증사진 찍기</button>
          <button className="btn wide" onClick={() => setSheet('floor')}>층 올리기</button>
          <button className="btn wide" onClick={() => setSheet('edit')}>이름과 브랜드 색 바꾸기</button>
          <button className="btn wide" onClick={() => setSheet('share')}>내 건물 보여주기</button>
        </section>
        <section className="card tight row between">
          <span className="muted">{p.nickname}님으로 들어와 있어요</span>
          <button className="btn small" onClick={() => void signOut()}>로그아웃</button>
        </section>
        <button className="linkish" onClick={() => setSheet('leave')}>마을 떠나기 (건물 없애기)</button>
      </div>
      {sheet === 'floor' && <AddFloor onClose={() => setSheet(null)} />}
      {sheet === 'edit' && <EditProfile onClose={() => setSheet(null)} />}
      {sheet === 'share' && <Share onClose={() => setSheet(null)} />}
      {sheet === 'leave' && <Leave onClose={() => setSheet(null)} />}
      {sheet === 'photo' && <PhotoSheet b={me} onClose={() => setSheet(null)} />}
    </div>
  )
}

function AddFloor({ onClose }: { onClose: () => void }) {
  const { reload } = useApp()
  const [busy, run] = useRun()
  const [type, setType] = useState<ChannelType | null>(null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [done, setDone] = useState(false)
  if (done) return <Celebrate icon="🏗️" title="한 층이 올라갔어요!" lines={['새 층에 기록을 남기고 꾸며 보세요.']} onDone={onClose} />
  return (
    <Sheet title="어떤 채널의 층을 올릴까요?" onClose={onClose}>
      <div className="pick-grid">
        {CHANNELS.map((c) => (
          <button key={c.type} className={`pick${type === c.type ? ' on' : ''}`} onClick={() => setType(c.type)} aria-pressed={type === c.type}>
            <span aria-hidden>{c.emoji}</span>{c.name}<small>{c.room}</small>
          </button>
        ))}
      </div>
      <label className="field">층 이름 (선택)
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="예: 내 블로그" />
      </label>
      <label className="field">채널 주소 (선택)
        <input className="input" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
      </label>
      <button className="btn primary big" disabled={!type || busy}
        onClick={() => run(async () => {
          await rpc('add_channel_floor', { p_channel_type: type, p_channel_name: name, p_channel_url: url })
          await reload()
          setDone(true)
        })}>
        층 올리기
      </button>
    </Sheet>
  )
}

export function EditProfile({ onClose }: { onClose: () => void }) {
  const { me, reload, toast } = useApp()
  const [busy, run] = useRun()
  const p = me!.profile
  const [nickname, setNickname] = useState(p.nickname)
  const [brand, setBrand] = useState(p.brand_name)
  const [tagline, setTagline] = useState(p.tagline)
  const [color, setColor] = useState(p.brand_color)
  return (
    <Sheet title="이름과 브랜드 색" onClose={onClose}>
      <label className="field">마을에서 불릴 이름
        <input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} />
      </label>
      <label className="field">간판에 적을 브랜드 이름
        <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={30} />
      </label>
      <label className="field">나를 소개하는 한 문장
        <input className="input" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={80} placeholder="예: 쉰에 시작한 디자인, 누구나 할 수 있어요" />
      </label>
      <div className="field">브랜드 색
        <div className="swatches">
          {BRAND_COLORS.map((c) => (
            <button key={c.hex} className={`swatch${color.toUpperCase() === c.hex ? ' on' : ''}`} style={{ background: c.hex }} onClick={() => setColor(c.hex)} aria-label={c.name} aria-pressed={color.toUpperCase() === c.hex} />
          ))}
        </div>
      </div>
      <button className="btn primary big" disabled={busy || !nickname.trim()}
        onClick={() => run(async () => {
          const { error } = await supabase.from('profiles')
            .update({ nickname: nickname.trim(), brand_name: brand.trim(), tagline: tagline.trim(), brand_color: color })
            .eq('id', p.id)
          if (error) throw error
          await reload()
          toast('바꿨어요.')
          onClose()
        })}>
        저장하기
      </button>
    </Sheet>
  )
}

function Share({ onClose }: { onClose: () => void }) {
  const { me, reload, toast } = useApp()
  const [busy, run] = useRun()
  const p = me!.profile
  const link = `${window.location.origin}/b/${p.public_key}`
  const toggle = (on: boolean) =>
    run(async () => {
      const { error } = await supabase.from('profiles').update({ is_public: on }).eq('id', p.id)
      if (error) throw error
      await reload()
    })
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast('주소를 복사했어요. 카카오톡에 붙여넣어 보세요.')
    } catch {
      toast('복사하지 못했어요. 아래 주소를 길게 눌러 복사해 주세요.')
    }
  }
  return (
    <Sheet title="내 건물 보여주기" onClose={onClose}>
      <p>공개로 바꾸면 이 주소를 아는 사람은 누구나 로그인 없이 내 건물을 볼 수 있어요. 언제든 다시 닫을 수 있어요.</p>
      <label className="check">
        <input type="checkbox" checked={p.is_public} disabled={busy} onChange={(e) => toggle(e.target.checked)} />
        <span>내 건물을 공개하기</span>
      </label>
      {p.is_public ? (
        <>
          <div className="copybox">{link}</div>
          <button className="btn primary big" onClick={copy}>주소 복사하기</button>
        </>
      ) : (
        <p className="empty">지금은 마을 이웃만 볼 수 있어요.</p>
      )}
    </Sheet>
  )
}

function Leave({ onClose }: { onClose: () => void }) {
  const { me, signOut, toast } = useApp()
  const [busy, run] = useRun()
  const [sure, setSure] = useState(false)
  if (!me) return null
  return (
    <Sheet title="마을 떠나기" onClose={onClose}>
      <div className="stack">
        <p>마을을 떠나면 <b>내 건물과 기록, 도장, 별, 물건이 모두 지워져요.</b> 지운 뒤에는 되돌릴 수 없어요.</p>
        <p className="muted">잠깐 쉬고 싶은 거라면 떠나지 않아도 괜찮아요. 쉬는 동안에도 건물은 그대로 있어요.</p>
        <label className="check"><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} /> 모두 지워지는 것을 알고 있어요</label>
        <button className="btn danger big" disabled={busy || !sure}
          onClick={() => run(async () => {
            await removeMemberFiles(me.profile.id)
            await rpc('leave_town')
            toast('마을을 떠났어요. 그동안 고마웠어요.')
            await signOut()
          })}>
          건물을 없애고 떠나기
        </button>
        <button className="btn wide" onClick={onClose}>그만두기</button>
      </div>
    </Sheet>
  )
}
