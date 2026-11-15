-- 8체질 테스트 앱 스키마 (Supabase SQL Editor에서 실행)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  provider text,
  constitution text,
  source text check (source in ('test','manual')),
  scores jsonb,
  answers jsonb,
  tested_at timestamptz,
  meals_per_day int not null default 3 check (meals_per_day between 2 and 5),
  plan_seed bigint not null default 1,
  updated_at timestamptz not null default now()
);
create table if not exists public.test_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  constitution text not null,
  top_pct int,
  source text,
  created_at timestamptz not null default now()
);
create index if not exists test_history_user_idx on public.test_history (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.test_history enable row level security;

create policy "own profile select" on public.profiles for select using ((select auth.uid()) = user_id);
create policy "own profile insert" on public.profiles for insert with check ((select auth.uid()) = user_id);
create policy "own profile update" on public.profiles for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own profile delete" on public.profiles for delete using ((select auth.uid()) = user_id);
create policy "own history select" on public.test_history for select using ((select auth.uid()) = user_id);
create policy "own history insert" on public.test_history for insert with check ((select auth.uid()) = user_id);
create policy "own history delete" on public.test_history for delete using ((select auth.uid()) = user_id);
