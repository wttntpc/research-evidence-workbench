-- Research Command Center: one private JSON workspace per signed-in user and slug.
-- Run this file once in the Supabase SQL Editor for the dedicated research project.

create table if not exists public.research_workspaces (
  user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null default 'default',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, slug)
);

alter table public.research_workspaces enable row level security;

revoke all on table public.research_workspaces from anon, authenticated;
grant select, insert, update, delete on table public.research_workspaces to authenticated;

drop policy if exists "Users read their own research workspace" on public.research_workspaces;
create policy "Users read their own research workspace"
on public.research_workspaces for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users create their own research workspace" on public.research_workspaces;
create policy "Users create their own research workspace"
on public.research_workspaces for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their own research workspace" on public.research_workspaces;
create policy "Users update their own research workspace"
on public.research_workspaces for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete their own research workspace" on public.research_workspaces;
create policy "Users delete their own research workspace"
on public.research_workspaces for delete
to authenticated
using ((select auth.uid()) = user_id);

comment on table public.research_workspaces is
  'Private research command-center workspaces protected by owner-scoped RLS.';
