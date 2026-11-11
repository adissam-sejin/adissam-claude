-- 전시실 스타일(테마): 관리자가 전시회마다 선택
alter table public.exhibitions
  add column if not exists theme text not null default 'white'
  check (theme in ('white', 'concrete', 'warm', 'accent'));

create or replace function public.exhibition_theme(p_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select theme from public.exhibitions where id = p_id;
$$;

create or replace function public.admin_set_theme(p_token uuid, p_id uuid, p_theme text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public._admin_ok(p_token);
  if p_theme not in ('white', 'concrete', 'warm', 'accent') then
    raise exception 'BAD_THEME';
  end if;
  update public.exhibitions set theme = p_theme where id = p_id;
end $$;

create or replace function public.admin_themes(p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public._admin_ok(p_token);
  return coalesce((select jsonb_object_agg(id, theme) from public.exhibitions), '{}'::jsonb);
end $$;

revoke all on function public.exhibition_theme(uuid), public.admin_set_theme(uuid, uuid, text), public.admin_themes(uuid) from public;
grant execute on function public.exhibition_theme(uuid), public.admin_set_theme(uuid, uuid, text), public.admin_themes(uuid) to anon, authenticated;
