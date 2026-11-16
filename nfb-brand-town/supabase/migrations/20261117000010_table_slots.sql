-- 꾸밀 자리 늘리기: 책상·선반 위에 놓는 "작은 소품" 자리(t1, t2 …)를 더한다.
--  · 작은 소품(table)은 책상 위에도, 바닥에도 놓을 수 있다.
--  · 큰 물건(floor)은 바닥에만, 벽 물건(wall)은 벽에만 놓는다.

alter table public.items drop constraint items_slot_check;
alter table public.items add constraint items_slot_check check (slot in ('floor', 'wall', 'table'));

alter table public.placements drop constraint placements_slot_key_check;
alter table public.placements add constraint placements_slot_key_check check (slot_key ~ '^[fwt][1-9]$');

-- 원래 있던 물건 가운데 작은 것들은 책상 위에도 놓을 수 있게 바꾼다.
-- (커피·찻주전자·타자기·등불은 그림에 받침 탁자나 스탠드가 함께 있어서 바닥 물건으로 둔다.)
update public.items set slot = 'table'
 where name in ('책 더미', '선인장', '작은 화분', '꽃다발', '바구니', '곰 인형', '졸업 모자', '수료 트로피');

insert into public.items (name, kind, slot, price, emoji, image_url, size, sort) values
  ('책상 조명',   'object', 'table',  6, '💡', '/art/items/desklamp.webp',   0.85, 41),
  ('노트북',      'object', 'table',  9, '💻', '/art/items/laptop.webp',     0.6,  42),
  ('연필꽂이',    'object', 'table',  3, '✏️', '/art/items/pencup.webp',     0.5,  43),
  ('자명종',      'object', 'table',  4, '⏰', '/art/items/alarmclock.webp', 0.5,  44),
  ('탁상 액자',   'object', 'table',  4, '🖼️', '/art/items/photoframe.webp', 0.55, 45),
  ('모니터',      'object', 'table', 10, '🖥️', '/art/items/monitor.webp',    0.75, 46),
  ('향초',        'object', 'table',  3, '🕯️', '/art/items/candle.webp',     0.45, 47),
  ('스노우볼',    'object', 'table',  7, '🔮', '/art/items/snowglobe.webp',  0.5,  48),
  ('라디오',      'object', 'table',  6, '📻', '/art/items/radio.webp',      0.55, 49),
  ('사진기',      'object', 'table',  9, '📷', '/art/items/dslr.webp',       0.5,  50),
  ('탁상 마이크', 'object', 'table',  8, '🎙️', '/art/items/deskmic.webp',    0.7,  51),
  ('붓통',        'object', 'table',  4, '🖌️', '/art/items/brushjar.webp',   0.55, 52),
  ('분재',        'object', 'table',  7, '🌳', '/art/items/bonsai.webp',     0.7,  53),
  ('금붕어 어항', 'object', 'table',  8, '🐟', '/art/items/fishbowl.webp',   0.55, 54),
  ('선풍기',      'object', 'table',  6, '🌀', '/art/items/fan.webp',        0.7,  55),
  ('선물 상자',   'object', 'table',  5, '🎁', '/art/items/gifts.webp',      0.6,  56),
  ('모래시계',    'object', 'table',  5, '⏳', '/art/items/hourglass.webp',  0.55, 57),
  ('걸이 화분',   'object', 'wall',   6, '🪴', '/art/items/hangingivy.webp', 1.0,  58);

create or replace function public.place_item(p_inventory_id uuid, p_floor_id uuid, p_slot_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_member();
  v_slot text; v_kind text; k text := left(p_slot_key, 1);
begin
  select i.slot, i.kind into v_slot, v_kind
    from public.inventory v join public.items i on i.id = v.item_id
   where v.id = p_inventory_id and v.user_id = uid;
  if not found then raise exception 'NOT_YOURS'; end if;
  if v_kind <> 'object' then raise exception 'NOT_PLACEABLE'; end if;
  if not exists (select 1 from public.floors where id = p_floor_id and user_id = uid) then
    raise exception 'NOT_YOURS';
  end if;
  if p_slot_key !~ '^[fwt][1-9]$'
     or (v_slot = 'floor' and k <> 'f')
     or (v_slot = 'wall' and k <> 'w')
     or (v_slot = 'table' and k not in ('t', 'f')) then
    raise exception 'WRONG_SLOT';
  end if;
  delete from public.placements where floor_id = p_floor_id and slot_key = p_slot_key;
  delete from public.placements where inventory_id = p_inventory_id;
  insert into public.placements (inventory_id, user_id, floor_id, slot_key)
  values (p_inventory_id, uid, p_floor_id, p_slot_key);
end $$;
