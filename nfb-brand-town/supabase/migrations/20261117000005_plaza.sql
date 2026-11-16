-- 광장: 회원 방명록과 아디쌤 소식(단톡방에 올린 글 모아두기)

insert into public.settings (key, value, label) values
  ('plaza_daily_max', '3', '하루에 광장 방명록에 남길 수 있는 글 수')
on conflict (key) do nothing;

create table public.plaza_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  note text not null check (char_length(note) between 1 and 120),
  day date not null,
  hidden_at timestamptz,
  created_at timestamptz not null default now()
);
create index plaza_notes_recent on public.plaza_notes (created_at desc) where hidden_at is null;

create table public.town_posts (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(body) between 1 and 2000),
  link text check (link is null or char_length(link) <= 500),
  posted_on date not null,
  pinned boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index town_posts_recent on public.town_posts (posted_on desc, created_at desc);

alter table public.plaza_notes enable row level security;
alter table public.town_posts  enable row level security;
revoke all on public.plaza_notes, public.town_posts from anon, authenticated;
grant select on public.plaza_notes to authenticated;
grant select, insert, update, delete on public.town_posts to authenticated;

create policy "members read" on public.plaza_notes for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()) or (hidden_at is null and (select private.is_member())));
create policy "members read" on public.town_posts for select to authenticated using ((select private.is_member()));
create policy "admin write"  on public.town_posts for all    to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- 방명록 남기기 (하루 상한)
create function public.add_plaza_note(p_note text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_member(); d date := private.kst_today(); n int; nid uuid;
begin
  select count(*) into n from public.plaza_notes where user_id = uid and day = d;
  if n >= private.setting_int('plaza_daily_max', 3) then raise exception 'PLAZA_MAX'; end if;
  insert into public.plaza_notes (user_id, note, day) values (uid, trim(p_note), d) returning id into nid;
  return nid;
end $$;

-- 내 글 지우기 / 관리자가 가리기
create function public.remove_plaza_note(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_member();
begin
  if private.is_admin() then
    update public.plaza_notes set hidden_at = now() where id = p_id;
    perform private.log('plaza_note_hide', p_id::text);
  else
    delete from public.plaza_notes where id = p_id and user_id = uid;
    if not found then raise exception 'NOT_YOURS'; end if;
  end if;
end $$;

revoke execute on function public.add_plaza_note(text), public.remove_plaza_note(uuid) from public, anon;
grant execute on function public.add_plaza_note(text), public.remove_plaza_note(uuid) to authenticated;
