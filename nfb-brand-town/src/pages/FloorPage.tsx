import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../ctx'
import { BuildingView } from '../components/Building'
import { PaintSheet, SlotSheet } from '../components/Decorate'
import type { Placement } from '../lib/types'
import { floorNumber, floorTitle } from '../lib/util'
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
  if (!me) return null
  const f = me.floors.find((x) => x.id === id)
  if (!f) return <Navigate to="/building" replace />

  return (
    <div className="split">
      <div className="sticky stack">
        <button className="backlink" onClick={() => nav('/building')}>← 내 건물로</button>
        <BuildingView b={me} only={f.id} onSlot={(_, key, cur) => setSlot({ key, cur })} />
        <p className="on-night-sub small center">＋ 표시가 있는 빈 자리를 누르면 물건을 놓을 수 있어요.</p>
        {f.kind !== 'rooftop' && (
          <button className="btn wide" onClick={() => setPaint(true)}>벽 색 바꾸기</button>
        )}
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
    </div>
  )
}
