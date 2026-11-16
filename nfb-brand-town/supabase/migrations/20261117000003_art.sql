-- 물건에 3D 그림과 크기를 붙이고, 새 물건을 더한다.
-- size: 방 높이에 대한 물건 키의 비율을 정하는 값 (1 = 보통 가구 높이)
alter table public.items add column if not exists size real not null default 1 check (size > 0 and size <= 2);

update public.items set image_url = '/art/items/plant.webp', size = 0.6 where name = '작은 화분';
update public.items set image_url = '/art/items/cactus.webp', size = 0.55 where name = '선인장';
update public.items set image_url = '/art/items/coffee.webp', size = 0.6 where name = '커피 한 잔';
update public.items set image_url = '/art/items/bouquet.webp', size = 0.65 where name = '꽃다발';
update public.items set image_url = '/art/items/basket.webp', size = 0.45 where name = '바구니';
update public.items set image_url = '/art/items/books.webp', size = 0.45 where name = '책 더미';
update public.items set image_url = '/art/items/teaset.webp', size = 0.5 where name = '찻주전자';
update public.items set image_url = '/art/items/teddy.webp', size = 0.55 where name = '곰 인형';
update public.items set image_url = '/art/items/chair.webp', size = 0.8 where name = '나무 의자';
update public.items set image_url = '/art/items/lantern.webp', size = 0.7 where name = '등불';
update public.items set image_url = '/art/items/ringlight.webp', size = 1.15 where name = '링 조명';
update public.items set image_url = '/art/items/typewriter.webp', size = 0.8 where name = '타자기';
update public.items set image_url = '/art/items/mic.webp', size = 1.05 where name = '마이크';
update public.items set image_url = '/art/items/guitar.webp', size = 0.95 where name = '기타';
update public.items set image_url = '/art/items/tree.webp', size = 1.3 where name = '큰 나무';
update public.items set image_url = '/art/items/sofa.webp', size = 0.85 where name = '푹신한 소파';
update public.items set image_url = '/art/items/parasol.webp', size = 1.35 where name = '파라솔';
update public.items set image_url = '/art/items/camera.webp', size = 1.05 where name = '촬영 카메라';
update public.items set image_url = '/art/items/cat.webp', size = 0.5 where name = '고양이';
update public.items set image_url = '/art/items/dog.webp', size = 0.5 where name = '강아지';
update public.items set image_url = '/art/items/piano.webp', size = 1.0 where name = '피아노';
update public.items set image_url = '/art/items/calendar.webp', size = 0.8 where name = '달력';
update public.items set image_url = '/art/items/frame.webp', size = 0.9 where name = '액자';
update public.items set image_url = '/art/items/windchime.webp', size = 0.9 where name = '풍경';
update public.items set image_url = '/art/items/clock.webp', size = 0.9 where name = '벽시계';
update public.items set image_url = '/art/items/map.webp', size = 1.0 where name = '지도';
update public.items set image_url = '/art/items/mirror.webp', size = 1.0 where name = '거울';
update public.items set image_url = '/art/items/painting.webp', size = 0.95 where name = '그림 한 점';
update public.items set image_url = '/art/items/window.webp', size = 1.25 where name = '큰 창문';
update public.items set image_url = '/art/items/medal.webp', size = 0.95 where name = '수료 메달';
update public.items set image_url = '/art/items/trophy.webp', size = 0.55 where name = '수료 트로피';
update public.items set image_url = '/art/items/gradcap.webp', size = 0.45 where name = '졸업 모자';

insert into public.items (name, kind, slot, price, emoji, image_url, size, sort) values
  ('지구본',      'object', 'floor',  6, '🌍', '/art/items/globe.webp',        0.85, 31),
  ('스탠드 조명', 'object', 'floor',  7, '💡', '/art/items/floorlamp.webp',    1.2,  32),
  ('작은 책장',   'object', 'floor',  9, '📚', '/art/items/bookcase.webp',     0.75, 33),
  ('전축',        'object', 'floor', 11, '🎶', '/art/items/recordplayer.webp', 0.75, 34);

-- 건물 조회에 물건 크기를 함께 돌려준다.
create or replace function private.building_json(p_uid uuid, p_public boolean) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  p public.profiles;
  w date := private.week_start(private.kst_today());
  result jsonb;
begin
  select * into p from public.profiles where id = p_uid;
  if not found then return null; end if;

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id, 'nickname', p.nickname, 'brand_name', p.brand_name, 'tagline', p.tagline,
      'brand_color', p.brand_color, 'plot_no', p.plot_no, 'is_public', p.is_public,
      'public_key', case when p_public then null else p.public_key end,
      'weekly_goal', p.weekly_goal, 'created_at', p.created_at),
    'floors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'kind', f.kind, 'channel_type', f.channel_type, 'channel_name', f.channel_name,
        'channel_url', f.channel_url, 'position', f.position, 'wall_color', f.wall_color,
        'record_count', (select count(*) from public.records r where r.floor_id = f.id and r.voided_at is null),
        'recent_records', coalesce((
          select jsonb_agg(x) from (
            select jsonb_build_object('id', r.id, 'url', r.url, 'note', r.note, 'day', r.day, 'input_type', r.input_type) x
              from public.records r where r.floor_id = f.id and r.voided_at is null
             order by r.created_at desc limit 12) s), '[]'::jsonb),
        'placements', coalesce((
          select jsonb_agg(jsonb_build_object(
            'slot_key', pl.slot_key, 'inventory_id', pl.inventory_id,
            'item', jsonb_build_object('id', i.id, 'name', i.name, 'emoji', i.emoji, 'image_url', i.image_url, 'slot', i.slot, 'size', i.size)))
            from public.placements pl
            join public.inventory v on v.id = pl.inventory_id
            join public.items i on i.id = v.item_id
           where pl.floor_id = f.id), '[]'::jsonb)
      ) order by f.position)
      from public.floors f where f.user_id = p_uid), '[]'::jsonb),
    'stars_earned', (select coalesce(sum(amount), 0) from public.star_ledger where user_id = p_uid and amount > 0),
    'stamps', (select count(*) from public.weekly_stamps where user_id = p_uid),
    'records', (select count(*) from public.records where user_id = p_uid and voided_at is null),
    'week', jsonb_build_object(
      'start', w,
      'count', (select count(*) from public.records where user_id = p_uid and week_start = w and voided_at is null),
      'goal', p.weekly_goal,
      'stamped', exists (select 1 from public.weekly_stamps where user_id = p_uid and week_start = w)),
    'courses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'course_id', c.id, 'title', c.title, 'kind', c.kind, 'session_count', c.session_count,
        'enrolled', exists (select 1 from public.enrollments e where e.user_id = p_uid and e.course_id = c.id),
        'stamps', coalesce((select jsonb_agg(ls.session_no order by ls.session_no)
                              from public.lecture_stamps ls where ls.user_id = p_uid and ls.course_id = c.id), '[]'::jsonb)
      ) order by c.sort, c.title)
      from public.courses c
      where exists (select 1 from public.enrollments e where e.user_id = p_uid and e.course_id = c.id)
         or exists (select 1 from public.lecture_stamps ls where ls.user_id = p_uid and ls.course_id = c.id)), '[]'::jsonb),
    'completions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cm.id, 'cert_no', cm.cert_no, 'course_id', c.id, 'title', c.title, 'completed_on', cm.completed_on,
        'status', cm.status,
        'item', (select jsonb_build_object('name', i.name, 'emoji', i.emoji, 'image_url', i.image_url)
                   from public.items i where i.id = c.reward_item_id)
      ) order by cm.completed_on nulls last, cm.requested_at)
      from public.completions cm join public.courses c on c.id = cm.course_id
      where cm.user_id = p_uid and (cm.status = 'approved' or not p_public)), '[]'::jsonb),
    'readings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rd.id, 'book_id', b.id, 'title', b.title, 'author', b.author, 'cover_url', b.cover_url,
        'note', rd.note, 'attended', rd.attended, 'created_at', rd.created_at) order by rd.created_at)
      from public.readings rd join public.books b on b.id = rd.book_id where rd.user_id = p_uid), '[]'::jsonb),
    'taste', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'kind', t.kind, 'shape', t.shape, 'label', t.label, 'emoji', t.emoji, 'photo_path', t.photo_path)
        order by t.created_at)
      from public.taste_items t where t.user_id = p_uid), '[]'::jsonb),
    'news', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id, 'kind', n.kind, 'note', n.note, 'url', n.url, 'photo_path', n.photo_path,
        'created_at', n.created_at, 'featured', n.featured_at is not null,
        'consent', case when p_public then null else n.consent end,
        'name_display', case when p_public then null else n.name_display end,
        'on_banner', n.created_at > now() - make_interval(days => private.setting_int('banner_days', 14)))
        order by n.created_at desc)
      from public.news n where n.user_id = p_uid and n.hidden_at is null), '[]'::jsonb),
    'my_books', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', mb.id, 'title', mb.title, 'stage', mb.stage, 'cover_url', mb.cover_url,
        'isbn', mb.isbn, 'buy_url', mb.buy_url) order by mb.created_at)
      from public.my_books mb where mb.user_id = p_uid), '[]'::jsonb),
    'cheers', (select count(*) from public.cheers where to_user = p_uid)
  ) into result;
  return result;
end $$;
