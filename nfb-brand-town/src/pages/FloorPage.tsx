import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../ctx'
import { BuildingView } from '../components/Building'
import { PaintSheet, SlotSheet } from '../components/Decorate'
import type { Placement } from '../lib/types'
import { floorNumber, floorTitle } from '../lib/util'
import { ROOMS, SLOT_LABEL, roomArt, slotKeys, slotKind } from '../lib/rooms'
import { PhotoSheet } from '../components/PhotoSheet'
import { Sprite } from '../components/ui'
import { sharedUrl } from '../lib/supabase'
import SnsPanel from './floor/SnsPanel'
import ClassroomPanel from './floor/ClassroomPanel'
import LibraryPanel from './floor/LibraryPanel'
import LobbyPanel from './floor/LobbyPanel'

export default function FloorPage() {
  const { id } = useParams()
  const { me } = useApp()
  const nav = useNavigate()
  const [slot, setSlot] = useState<{ key: string; cur?: Placement } | null>(null)
  const [paint, setPaint] = useState(false)
  const [photo, setPhoto] = useState(false)
  if (!me) return null
  const f = me.floors.find((x) => x.id === id)
  if (!f) return <Navigate to="/building" replace />

  return (
    <div className="split">
      <div className="sticky stack">
        <button className="backlink" onClick={() => nav('/building')}>← 내 건물로</button>
        <BuildingView b={me} only={f.id} onSlot={(_, key, cur) => setSlot({ key, cur })} />
        <div className="row">
          <button className="btn grow" onClick={() => setPhoto(true)}>📸 이 층 인증사진</button>
          {f.kind !== 'rooftop' && <button className="btn grow" onClick={() => setPaint(true)}>벽 색 바꾸기</button>}
        </div>
        <section className="card tight stack">
          <h3>꾸미기 자리 {f.placements.length} / {slotKeys(roomArt(f)).length}</h3>
          <p className="muted small">그림에서 ＋ 표시를 눌러도 되고, 아래에서 골라도 돼요.</p>
          <ul className="list">
            {slotKeys(roomArt(f)).map((key) => {
              const cur = f.placements.find((x) => x.slot_key === key)
              return (
                <li key={key}>
                  <span className="ico">{cur ? <Sprite emoji={cur.item.emoji} image={sharedUrl(cur.item.image_url)} label={cur.item.name} /> : <span aria-hidden>＋</span>}</span>
                  <span className="txt"><b>{SLOT_LABEL[slotKind(key)]} 자리 {key.slice(1)}</b>{cur ? cur.item.name : '비어 있어요'}</span>
                  <button className={`btn small${cur ? '' : ' primary'}`} onClick={() => setSlot({ key, cur })}>{cur ? '바꾸기' : '놓기'}</button>
                </li>
              )
            })}
          </ul>
          {ROOMS[roomArt(f)].wall.length === 0 && <p className="muted small">이 방에는 바닥에 놓는 물건만 둘 수 있어요.</p>}
        </section>
      </div>
      <div className="stack">
        <h1 className="on-night">{f.kind === 'rooftop' ? '옥상' : `${floorNumber(me.floors, f)} · ${floorTitle(f)}`}</h1>
        {f.kind === 'sns' && <SnsPanel f={f} />}
        {f.kind === 'classroom' && <ClassroomPanel />}
        {f.kind === 'library' && <LibraryPanel />}
        {f.kind === 'lobby' && <LobbyPanel />}
        {f.kind === 'rooftop' && (
          <section className="card stack">
            <h2>옥상 정원</h2>
            <p>나무와 화분, 등불을 놓아 꾸며 보세요. 지금까지 모은 별 {me.stars_earned}개가 건물 위 밤하늘에 떠 있어요.</p>
          </section>
        )}
      </div>
      {slot && <SlotSheet floor={f} slotKey={slot.key} current={slot.cur} onClose={() => setSlot(null)} />}
      {paint && <PaintSheet floor={f} onClose={() => setPaint(false)} />}
      {photo && <PhotoSheet b={me} floorId={f.id} onClose={() => setPhoto(false)} />}
    </div>
  )
}
