-- 시작 화면에 "지금 마을에 건물이 몇 채 있는지" 보여주기 위한 숫자.
-- 로그인하지 않은 사람도 볼 수 있지만, 숫자 하나만 돌려준다 (이름·내용은 주지 않는다).
create function public.get_town_count() returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.profiles;
$$;

revoke all on function public.get_town_count() from public;
grant execute on function public.get_town_count() to anon, authenticated;
