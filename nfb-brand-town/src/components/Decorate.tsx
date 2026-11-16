import { useEffect, useMemo, useState } from 'react'
import { useApp, useRun } from '../ctx'
import { rpc } from '../lib/api'
import { supabase, sharedUrl } from '../lib/supabase'
import type { Floor, InventoryRow, Item, Placement } from '../lib/types'
import { Loading, Sheet, Sprite } from './ui'
import { josa } from '../lib/util'
import { fitsSlot, slotKind } from '../lib/rooms'

async function loadGoods(userId: string) {
  const [inv, items] = await Promise.all([
    supabase.from('inventory').select('id,item_id,source,items(*)').eq('user_id', userId),
    supabase.from('items').select('*').eq('active', true).order('sort'),
  ])
  return { inv: (inv.data ?? []) as unknown as InventoryRow[], items: (items.data ?? []) as Item[] }
}

export function onSale(it: Item, today: string) {
  return it.source === 'shop' && (!it.sale_start || today >= it.sale_start) && (!it.sale_end || today <= it.sale_end)
}

// 빈 자리를 누르면: 보관함에서 꺼내거나, 가게에서 사서 바로 놓는다.
export function SlotSheet({ floor, slotKey, current, onClose }: { floor: Floor; slotKey: string; current?: Placement; onClose: () => void }) {
  const { me, today, session, reload, toast } = useApp()
  const [busy, run] = useRun()
  const [goods, setGoods] = useState<{ inv: InventoryRow[]; items: Item[] } | null>(null)
  const [tab, setTab] = useState<'inv' | 'shop'>('inv')
  const [pick, setPick] = useState<Item | null>(null)
  const want = slotKind(slotKey)

  useEffect(() => {
    void loadGoods(session!.user.id).then((g) => {
      setGoods(g)
      const placed = new Set(me!.floors.flatMap((f) => f.placements.map((p) => p.inventory_id)))
      const free = g.inv.filter((v) => v.items.kind === 'object' && fitsSlot(v.items.slot, slotKey) && !placed.has(v.id))
      if (free.length === 0) setTab('shop')
    })
  }, [session, me, slotKey])

  const placed = useMemo(() => new Set(me!.floors.flatMap((f) => f.placements.map((p) => p.inventory_id))), [me])
  if (!goods) return <Sheet title="물건 놓기" onClose={onClose}><Loading /></Sheet>

  const free = goods.inv.filter((v) => v.items.kind === 'object' && fitsSlot(v.items.slot, slotKey) && !placed.has(v.id))
  // 책상 위 자리에는 작은 소품만, 바닥 자리에는 큰 물건을 먼저 보여 준다.
  const shop = goods.items
    .filter((it) => it.kind === 'object' && fitsSlot(it.slot, slotKey) && onSale(it, today!.today))
    .sort((a, b) => Number(a.slot !== want) - Number(b.slot !== want))
  const balance = today!.balance

  const place = (inventoryId: string) =>
    run(async () => {
      await rpc('place_item', { p_inventory_id: inventoryId, p_floor_id: floor.id, p_slot_key: slotKey })
      await reload()
      onClose()
    })
  const buyAndPlace = (it: Item) =>
    run(async () => {
      const r = await rpc<{ inventory_id: string }>('buy_item', { p_item_id: it.id })
      await rpc('place_item', { p_inventory_id: r.inventory_id, p_floor_id: floor.id, p_slot_key: slotKey })
      await reload()
      toast(`${josa(it.name, '을', '를')} 놓았어요.`)
      onClose()
    })
  const remove = () =>
    run(async () => {
      await rpc('unplace_item', { p_inventory_id: current!.inventory_id })
      await reload()
      toast('보관함에 넣어 두었어요.')
      onClose()
    })

  if (pick) {
    const enough = balance >= pick.price
    return (
      <Sheet title={pick.name} onClose={() => setPick(null)}>
        <div className="center" style={{ fontSize: '5rem', lineHeight: 1.1 }}>
          <Sprite emoji={pick.emoji} image={sharedUrl(pick.image_url)} label={pick.name} />
        </div>
        <p className="center">별 <b>{pick.price}개</b>가 들어요. 지금 가진 별은 {balance}개예요.</p>
        {enough ? (
          <button className="btn primary big" disabled={busy} onClick={() => buyAndPlace(pick)}>별 {pick.price}개로 사서 놓기</button>
        ) : (
          <p className="empty">별이 {pick.price - balance}개 모자라요. 기록을 남기면 별이 모여요.</p>
        )}
        <button className="btn ghost wide" onClick={() => setPick(null)}>다른 물건 보기</button>
      </Sheet>
    )
  }

  return (
    <Sheet title={want === 'floor' ? '바닥에 놓을 물건' : want === 'wall' ? '벽에 걸 물건' : '책상 위에 놓을 소품'} onClose={onClose}>
      {current && (
        <div className="row between card tight" style={{ boxShadow: 'none', background: 'var(--card-2)' }}>
          <span>지금 놓인 물건: <b>{current.item.name}</b></span>
          <button className="btn small" disabled={busy} onClick={remove}>치우기</button>
        </div>
      )}
      <div className="chips" role="tablist">
        <button className={`chip${tab === 'inv' ? ' on' : ''}`} role="tab" aria-selected={tab === 'inv'} onClick={() => setTab('inv')}>내 보관함 {free.length}</button>
        <button className={`chip${tab === 'shop' ? ' on' : ''}`} role="tab" aria-selected={tab === 'shop'} onClick={() => setTab('shop')}>별마트</button>
        <span className="stars-pill" style={{ marginLeft: 'auto' }}>⭐ {balance}</span>
      </div>
      {tab === 'inv' && (free.length === 0 ? (
        <p className="empty">이 자리에 놓을 물건이 보관함에 없어요. 별마트에서 골라 보세요.</p>
      ) : (
        <div className="shop-grid">
          {free.map((v) => (
            <button key={v.id} className="shop-item" disabled={busy} onClick={() => place(v.id)}>
              <span className="pic"><Sprite emoji={v.items.emoji} image={sharedUrl(v.items.image_url)} label={v.items.name} /></span>
              <b>{v.items.name}</b>
              <span className="muted small">여기에 놓기</span>
            </button>
          ))}
        </div>
      ))}
      {tab === 'shop' && (
        <div className="shop-grid">
          {shop.map((it) => (
            <button key={it.id} className="shop-item" onClick={() => setPick(it)}>
              <span className="pic"><Sprite emoji={it.emoji} image={sharedUrl(it.image_url)} label={it.name} /></span>
              <b>{it.name}</b>
              <span className="price">⭐ {it.price}</span>
              {it.season && <span className="tag">{it.season}</span>}
            </button>
          ))}
        </div>
      )}
    </Sheet>
  )
}

// 벽 색 바꾸기: 가진 색은 언제든 다시 칠할 수 있다.
export function PaintSheet({ floor, onClose }: { floor: Floor; onClose: () => void }) {
  const { today, session, reload, toast } = useApp()
  const [busy, run] = useRun()
  const [goods, setGoods] = useState<{ inv: InventoryRow[]; items: Item[] } | null>(null)
  useEffect(() => {
    void loadGoods(session!.user.id).then(setGoods)
  }, [session])
  if (!goods) return <Sheet title="벽 색 바꾸기" onClose={onClose}><Loading /></Sheet>

  const owned = goods.inv.filter((v) => v.items.kind === 'wall_paint')
  const ownedIds = new Set(owned.map((v) => v.item_id))
  const shop = goods.items.filter((it) => it.kind === 'wall_paint' && onSale(it, today!.today) && !ownedIds.has(it.id))
  const balance = today!.balance

  const paint = (inventoryId: string | null) =>
    run(async () => {
      await rpc('paint_wall', { p_floor_id: floor.id, p_inventory_id: inventoryId })
      await reload()
      onClose()
    })
  const buyAndPaint = (it: Item) =>
    run(async () => {
      const r = await rpc<{ inventory_id: string }>('buy_item', { p_item_id: it.id })
      await rpc('paint_wall', { p_floor_id: floor.id, p_inventory_id: r.inventory_id })
      await reload()
      toast(`${it.name}으로 칠했어요.`.replace('벽으로', '벽 색으로'))
      onClose()
    })

  return (
    <Sheet title="벽 색 바꾸기" onClose={onClose}>
      <h3>가진 색</h3>
      <div className="shop-grid">
        <button className="shop-item" disabled={busy} onClick={() => paint(null)}>
          <span className="pic"><i style={{ background: '#F4E4C8' }} /></span>
          <b>처음 색</b>
        </button>
        {owned.map((v) => (
          <button key={v.id} className="shop-item" disabled={busy} onClick={() => paint(v.id)}>
            <span className="pic"><i style={{ background: v.items.color ?? '#fff' }} /></span>
            <b>{v.items.name}</b>
          </button>
        ))}
      </div>
      <div className="row between">
        <h3>별마트에 있는 색</h3>
        <span className="stars-pill">⭐ {balance}</span>
      </div>
      <p className="muted small">한 번 사면 모든 층에 몇 번이든 칠할 수 있어요.</p>
      <div className="shop-grid">
        {shop.map((it) => (
          <button key={it.id} className="shop-item" disabled={busy || balance < it.price} onClick={() => buyAndPaint(it)}>
            <span className="pic"><i style={{ background: it.color ?? '#fff' }} /></span>
            <b>{it.name}</b>
            <span className="price">⭐ {it.price}</span>
          </button>
        ))}
        {shop.length === 0 && <p className="empty">모든 색을 가지고 있어요.</p>}
      </div>
    </Sheet>
  )
}
