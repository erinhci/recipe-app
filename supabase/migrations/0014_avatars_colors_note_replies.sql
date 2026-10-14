-- Avatars, personal colors, the kitchen's shared scene, two-chef meals,
-- and likes and replies on notes.
-- Safe to run again: everything is "if not exists" or replaces.

-- ---------------------------------------------------------------------------
-- Each cook's color and avatar
-- ---------------------------------------------------------------------------

-- One of five colors (see 0015 if this was run with the earlier four).
-- Two cooks in a kitchen can't have the same one.
alter table public.members add column if not exists color text
  check (color is null or color in ('berry', 'orange', 'green', 'ocean', 'violet'));
create unique index if not exists members_one_color_each
  on public.members (kitchen_id, color) where removed_at is null and color is not null;

-- What the avatar wears: {"outfit": "apron", "hat": "chef"}. Which items
-- are unlocked comes from the kitchen's badges, worked out in the app.
alter table public.members add column if not exists avatar jsonb not null default '{}';

grant update (display_name, unit_pref, color, avatar) on public.members to authenticated;

-- ---------------------------------------------------------------------------
-- The kitchen's shared scene: where the two avatars are and their pose
-- ---------------------------------------------------------------------------

alter table public.kitchens add column if not exists scene text not null default 'home'
  check (scene in ('home', 'market', 'picnic'));
alter table public.kitchens add column if not exists duo_pose text not null default 'wave'
  check (duo_pose in ('wave', 'highfive', 'taste'));

-- ---------------------------------------------------------------------------
-- Meals cooked in two-chef mode (for the "First two-chef cook" badge)
-- ---------------------------------------------------------------------------

alter table public.cook_log add column if not exists two_chef boolean not null default false;

-- Mark past meals that had a finished two-chef cook on or next to that day.
update public.cook_log c set two_chef = true
where not c.two_chef and exists (
  select 1 from public.two_chef_cooks t
  where t.recipe_id = c.recipe_id
    and t.ended_at is not null
    and abs(t.started_at::date - c.cooked_on) <= 1
);

-- ---------------------------------------------------------------------------
-- Replies: a note can answer another note on the same recipe
-- ---------------------------------------------------------------------------

alter table public.notes add column if not exists parent_id uuid
  references public.notes (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- Likes on notes: one per cook per note
-- ---------------------------------------------------------------------------

create table if not exists public.note_likes (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  member_id uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  unique (note_id, member_id)
);
create index if not exists note_likes_note_idx on public.note_likes (note_id);

alter table public.note_likes enable row level security;

drop policy if exists "read likes" on public.note_likes;
create policy "read likes" on public.note_likes
  for select using (
    exists (select 1 from public.notes n where n.id = note_id and public.recipe_in_my_kitchen(n.recipe_id))
  );
drop policy if exists "add own likes" on public.note_likes;
create policy "add own likes" on public.note_likes
  for insert with check (
    member_id = auth.uid()
    and exists (select 1 from public.notes n where n.id = note_id and public.recipe_in_my_kitchen(n.recipe_id))
  );
drop policy if exists "remove own likes" on public.note_likes;
create policy "remove own likes" on public.note_likes
  for delete using (member_id = auth.uid());

grant select, insert, delete on public.note_likes to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: the other phone hears about likes and scene changes
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['note_likes', 'kitchens'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
