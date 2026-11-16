import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp, useRun } from '../ctx'
import { rpc, removeMemberFiles } from '../lib/api'
import { supabase, sharedUrl } from '../lib/supabase'
import { BuildingView } from '../components/Building'
import { Celebrate, Loading, Sheet, Sprite } from '../components/ui'
import { BRAND_COLORS, CHANNELS } from '../lib/util'
import { PhotoSheet } from '../components/PhotoSheet'
import { isStandalone, showInstallGuide } from '../lib/install'
import type { ChannelType, InventoryRow } from '../lib/types'
import { SLOT_LABEL, slotKind } from '../lib/rooms'
import { floorNumber, floorTitle } from '../lib/util'

export default function MyBuilding() {
  const { me, signOut } = useApp()
  const nav = useNavigate()
  const [sheet, setSheet] = useState<null | 'floor' | 'edit' | 'share' | 'photo' | 'leave' | 'things'>(null)
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
          <button className="btn wide" onClick={() => setSheet('things')}>🧺 내 물건 보기 (보관함)</button>
          <button className="btn wide" onClick={() => nav('/place/mart')}>⭐ 별마트 가기</button>
          <button className="btn wide" onClick={() => setSheet('floor')}>층 올리기</button>
          <button className="btn wide" onClick={() => setSheet('edit')}>이름과 브랜드 색 바꾸기</button>
          <button className="btn wide" onClick={() => setSheet('share')}>내 건물 보여주기</button>
          {!isStandalone() && <button className="btn wide" onClick={showInstallGuide}>📱 홈 화면에 앱으로 저장하기</button>}
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
      {sheet === 'things' && <MyThings onClose={() => setSheet(null)} />}
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

// 내가 가진 물건을 모두 본다: 방에 놓은 것, 보관함에 있는 것, 가진 벽 색
function MyThings({ onClose }: { onClose: () => void }) {
  const { me, session } = useApp()
  const nav = useNavigate()
  const [inv, setInv] = useState<InventoryRow[] | null>(null)
  useEffect(() => {
    void supabase.from('inventory').select('id,item_id,source,items(*)').eq('user_id', session!.user.id).order('acquired_at')
      .then(({ data }) => setInv((data ?? []) as unknown as InventoryRow[]))
  }, [session])
  if (!me) return null
  if (!inv) return <Sheet title="내 물건" onClose={onClose}><Loading /></Sheet>

  const where = new Map<string, { floorId: string; text: string }>()
  for (const f of me.floors) {
    const name = f.kind === 'rooftop' ? '옥상' : `${floorNumber(me.floors, f)} ${floorTitle(f)}`
    for (const p of f.placements) where.set(p.inventory_id, { floorId: f.id, text: `${name} · ${SLOT_LABEL[slotKind(p.slot_key)]}` })
  }
  const objects = inv.filter((v) => v.items.kind === 'object')
  const placed = objects.filter((v) => where.has(v.id))
  const stored = objects.filter((v) => !where.has(v.id))
  const paints = inv.filter((v) => v.items.kind === 'wall_paint')
  const from = (v: InventoryRow) => (v.source === 'shop' ? '' : v.source === 'gift' ? ' · 선물 받음' : ' · 기념품')

  return (
    <Sheet title={`내 물건 ${objects.length}개`} onClose={onClose}>
      <div className="stack">
        <p className="muted">별마트에서 사거나 선물·기념품으로 받은 물건이 모두 여기에 있어요. <b>보관함</b>은 아직 방에 놓지 않은 물건을 넣어 두는 곳이에요.</p>

        <h3>보관함에 있는 물건 {stored.length}개</h3>
        {stored.length === 0 ? <p className="empty">보관함이 비어 있어요.</p> : (
          <>
            <ul className="list">
              {stored.map((v) => (
                <li key={v.id}>
                  <span className="ico"><Sprite emoji={v.items.emoji} image={sharedUrl(v.items.image_url)} label={v.items.name} /></span>
                  <span className="txt"><b>{v.items.name}</b>{SLOT_LABEL[v.items.slot]}에 놓는 물건{from(v)}</span>
                </li>
              ))}
            </ul>
            <p className="muted small">놓으려면 건물에서 층을 누르고, 방 그림의 ＋ 자리를 눌러 주세요.</p>
          </>
        )}

        <h3>방에 놓은 물건 {placed.length}개</h3>
        {placed.length === 0 ? <p className="empty">아직 방에 놓은 물건이 없어요.</p> : (
          <ul className="list">
            {placed.map((v) => (
              <li key={v.id}>
                <span className="ico"><Sprite emoji={v.items.emoji} image={sharedUrl(v.items.image_url)} label={v.items.name} /></span>
                <span className="txt"><b>{v.items.name}</b>{where.get(v.id)!.text}{from(v)}</span>
                <button className="btn ghost small" onClick={() => nav(`/floor/${where.get(v.id)!.floorId}`)}>그 방 보기</button>
              </li>
            ))}
          </ul>
        )}

        {paints.length > 0 && (
          <>
            <h3>가진 벽 색 {paints.length}개</h3>
            <div className="chips">
              {paints.map((v) => <span key={v.id} className="chip" style={{ cursor: 'default' }}><i className="dotc" style={{ background: v.items.color ?? '#fff', border: '1px solid var(--line)' }} /> {v.items.name}</span>)}
            </div>
          </>
        )}
        <button className="btn primary wide" onClick={() => nav('/place/mart')}>⭐ 별마트에서 물건 사기</button>
      </div>
    </Sheet>
  )
}
