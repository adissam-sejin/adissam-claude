-- 관리 화면의 회원 목록, 회원 내보내기, 스스로 마을 떠나기.

-- 회원 목록: 이름·간판·활동 숫자만 준다 (이메일·연락처는 주지 않는다).
create function public.admin_members() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare aid uuid := private.require_admin();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'nickname', p.nickname, 'brand_name', p.brand_name, 'brand_color', p.brand_color,
      'role', p.role, 'plot_no', p.plot_no, 'created_at', p.created_at, 'is_me', p.id = aid,
      'floors', (select count(*) from public.floors f where f.user_id = p.id),
      'records', (select count(*) from public.records r where r.user_id = p.id and r.voided_at is null),
      'last_record', (select max(r.day) from public.records r where r.user_id = p.id and r.voided_at is null),
      'stamps', (select count(*) from public.weekly_stamps ws where ws.user_id = p.id),
      'balance', private.balance(p.id)
    ) order by p.created_at)
    from public.profiles p), '[]'::jsonb);
end $$;

-- 한 회원이 올린 사진 파일의 경로 (지우기 전에 파일부터 치우려고 쓴다). 본인이나 관리자만.
create function public.member_photo_paths(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.require_member();
begin
  if p_user_id <> uid and not private.is_admin() then raise exception 'NOT_ADMIN'; end if;
  return jsonb_build_object(
    'proofs', coalesce((select jsonb_agg(r.photo_path) from public.records r
                        where r.user_id = p_user_id and r.photo_path is not null), '[]'::jsonb),
    'shared', coalesce((select jsonb_agg(x.photo_path) from (
                          select t.photo_path from public.taste_items t where t.user_id = p_user_id and t.photo_path is not null
                          union
                          select n.photo_path from public.news n where n.user_id = p_user_id and n.photo_path is not null) x), '[]'::jsonb));
end $$;

-- 관리자가 회원을 내보낸다. 건물·기록·별이 모두 함께 지워진다.
create function public.admin_remove_member(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare aid uuid := private.require_admin(); n int;
begin
  if p_user_id = aid then raise exception 'SELF_REMOVE'; end if;
  select plot_no into n from public.profiles where id = p_user_id;
  if not found then raise exception 'NO_USER'; end if;
  perform private.log('member_remove', p_user_id::text, jsonb_build_object('plot_no', n));
  delete from auth.users where id = p_user_id;
end $$;

-- 회원이 스스로 마을을 떠난다. 관리자가 한 명뿐이면 그 관리자는 떠날 수 없다.
create function public.leave_town() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_member();
begin
  if private.is_admin() and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'LAST_ADMIN';
  end if;
  delete from auth.users where id = uid;
end $$;

revoke all on function public.admin_members(), public.member_photo_paths(uuid), public.admin_remove_member(uuid), public.leave_town() from public, anon;
grant execute on function public.admin_members(), public.member_photo_paths(uuid), public.admin_remove_member(uuid), public.leave_town() to authenticated;

-- 사진 파일 지우기: 본인 것은 본인이, 떠난 회원 것은 관리자가 치운다.
create policy "shared: own or admin read" on storage.objects for select to authenticated
  using (bucket_id = 'shared' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin())));
create policy "proofs: own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "member files: admin delete" on storage.objects for delete to authenticated
  using (bucket_id in ('shared', 'proofs') and (select private.is_admin()));
