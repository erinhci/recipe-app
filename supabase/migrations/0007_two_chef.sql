-- Two-chef mode: a recipe's steps split into two tracks, one per cook,
-- with shared steps where the tracks meet. Both phones follow one live
-- record of who has which track and which steps are done.
-- Run once in the Supabase SQL editor. Safe to run more than once.

-- The split, saved with the recipe so it works offline.
-- chef_tracks: {"a": "Sauce", "b": "Pasta"}. steps.track: 'a', 'b', or
-- 'both' (a shared step, done once both tracks reach it).
alter table public.recipes add column if not exists chef_tracks jsonb;
alter table public.steps add column if not exists track text
  check (track in ('a', 'b', 'both'));

-- One open two-chef cook per recipe at a time.
create table if not exists public.two_chef_cooks (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  chef_a uuid references auth.users (id),
  chef_b uuid references auth.users (id),
  done_steps uuid[] not null default '{}',
  -- Steps moved to the other cook for this cook only: {"<step id>": "a"}.
  moved_steps jsonb not null default '{}',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  updated_at timestamptz not null default now()
);
create unique index if not exists two_chef_one_open
  on public.two_chef_cooks (recipe_id) where ended_at is null;

alter table public.two_chef_cooks enable row level security;
drop policy if exists "see two-chef cooks in own kitchen" on public.two_chef_cooks;
create policy "see two-chef cooks in own kitchen" on public.two_chef_cooks
  for select using (public.recipe_in_my_kitchen(recipe_id));
-- Changes go through the functions below, so two phones tapping at once
-- can't overwrite each other.
grant select on public.two_chef_cooks to authenticated;

-- The other phone hears about changes within about a second.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'two_chef_cooks'
  ) then
    alter publication supabase_realtime add table public.two_chef_cooks;
  end if;
end $$;

-- Opens the recipe's two-chef cook, or returns the one already open.
-- A cook left open for more than 6 hours is closed first.
create or replace function public.start_two_chef(p_recipe uuid)
returns public.two_chef_cooks
language plpgsql security definer set search_path = public as $$
declare
  c two_chef_cooks;
begin
  if not recipe_in_my_kitchen(p_recipe) then raise exception 'Recipe not found'; end if;
  update two_chef_cooks set ended_at = now(), updated_at = now()
    where recipe_id = p_recipe and ended_at is null and started_at < now() - interval '6 hours';
  insert into two_chef_cooks (recipe_id) values (p_recipe)
    on conflict (recipe_id) where ended_at is null do nothing;
  select * into c from two_chef_cooks where recipe_id = p_recipe and ended_at is null;
  return c;
end $$;

-- Picks a track for the signed-in cook. The other cook in the kitchen
-- gets the other track. If both phones pick the same track at once, the
-- first one wins and the second gets the remaining track.
create or replace function public.claim_chef(p_cook uuid, p_side text)
returns public.two_chef_cooks
language plpgsql security definer set search_path = public as $$
declare
  c two_chef_cooks;
  me uuid := auth.uid();
  partner uuid;
  mine uuid;
  theirs uuid;
  taken uuid;
begin
  if p_side not in ('a', 'b') then raise exception 'Pick track a or b'; end if;
  select * into c from two_chef_cooks where id = p_cook for update;
  if not found or not recipe_in_my_kitchen(c.recipe_id) then raise exception 'Cook not found'; end if;

  -- Taken by the other cook already: take the other track.
  taken := case p_side when 'a' then c.chef_a else c.chef_b end;
  if taken is not null and taken <> me then
    p_side := case p_side when 'a' then 'b' else 'a' end;
    taken := case p_side when 'a' then c.chef_a else c.chef_b end;
    if taken is not null and taken <> me then
      raise exception 'Both tracks are taken';
    end if;
  end if;

  select user_id into partner from members
    where kitchen_id = my_kitchen_id() and removed_at is null and user_id <> me
    limit 1;
  theirs := case p_side when 'a' then c.chef_b else c.chef_a end;
  if theirs is null or theirs = me then theirs := partner; end if;
  mine := me;

  update two_chef_cooks set
    chef_a = case p_side when 'a' then mine else theirs end,
    chef_b = case p_side when 'b' then mine else theirs end,
    updated_at = now()
  where id = p_cook
  returning * into c;
  return c;
end $$;

create or replace function public.swap_chefs(p_cook uuid)
returns public.two_chef_cooks
language plpgsql security definer set search_path = public as $$
declare
  c two_chef_cooks;
begin
  select * into c from two_chef_cooks where id = p_cook for update;
  if not found or not recipe_in_my_kitchen(c.recipe_id) then raise exception 'Cook not found'; end if;
  update two_chef_cooks set chef_a = c.chef_b, chef_b = c.chef_a, updated_at = now()
    where id = p_cook returning * into c;
  return c;
end $$;

create or replace function public.set_step_done(p_cook uuid, p_step uuid, p_done boolean)
returns public.two_chef_cooks
language plpgsql security definer set search_path = public as $$
declare
  c two_chef_cooks;
begin
  select * into c from two_chef_cooks where id = p_cook for update;
  if not found or not recipe_in_my_kitchen(c.recipe_id) then raise exception 'Cook not found'; end if;
  update two_chef_cooks set
    done_steps = case when p_done
      then array_append(array_remove(done_steps, p_step), p_step)
      else array_remove(done_steps, p_step) end,
    updated_at = now()
  where id = p_cook returning * into c;
  return c;
end $$;

create or replace function public.move_step(p_cook uuid, p_step uuid, p_track text)
returns public.two_chef_cooks
language plpgsql security definer set search_path = public as $$
declare
  c two_chef_cooks;
begin
  if p_track not in ('a', 'b', 'both') then raise exception 'Unknown track'; end if;
  select * into c from two_chef_cooks where id = p_cook for update;
  if not found or not recipe_in_my_kitchen(c.recipe_id) then raise exception 'Cook not found'; end if;
  update two_chef_cooks set
    moved_steps = moved_steps || jsonb_build_object(p_step::text, p_track),
    updated_at = now()
  where id = p_cook returning * into c;
  return c;
end $$;

create or replace function public.end_two_chef(p_cook uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update two_chef_cooks set ended_at = now(), updated_at = now()
    where id = p_cook and ended_at is null and recipe_in_my_kitchen(recipe_id);
end $$;

grant execute on function public.start_two_chef(uuid) to authenticated;
grant execute on function public.claim_chef(uuid, text) to authenticated;
grant execute on function public.swap_chefs(uuid) to authenticated;
grant execute on function public.set_step_done(uuid, uuid, boolean) to authenticated;
grant execute on function public.move_step(uuid, uuid, text) to authenticated;
grant execute on function public.end_two_chef(uuid) to authenticated;
