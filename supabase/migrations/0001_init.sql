-- Our Kitchen: initial schema
-- Paste this whole file into the Supabase SQL editor and run it once.
-- It creates the tables, security rules, helper functions, stats views,
-- the storage bucket for original screenshots and PDFs, and realtime sync.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.kitchens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  kitchen_id uuid not null references public.kitchens (id) on delete cascade,
  display_name text not null,
  unit_pref text not null default 'us' check (unit_pref in ('us', 'metric')),
  joined_at timestamptz not null default now()
);
create index members_kitchen_idx on public.members (kitchen_id);

create table public.invites (
  code text primary key,
  kitchen_id uuid not null references public.kitchens (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users (id),
  used_at timestamptz
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens (id) on delete cascade,
  title text not null,
  base_servings numeric not null default 2 check (base_servings > 0),
  cuisine text,
  meal_type text,
  tags text[] not null default '{}',
  total_time_minutes int,
  source_type text not null default 'manual'
    check (source_type in ('manual', 'url', 'photo', 'pdf', 'text')),
  source_url text,
  original_file text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id)
);
create index recipes_kitchen_idx on public.recipes (kitchen_id);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  position int not null,
  quantity numeric,
  unit text,
  item text not null,
  prep_note text,
  raw_text text,
  needs_review boolean not null default false,
  updated_at timestamptz not null default now()
);
create index ingredients_recipe_idx on public.ingredients (recipe_id);

create table public.steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  position int not null,
  text text not null,
  updated_at timestamptz not null default now()
);
create index steps_recipe_idx on public.steps (recipe_id);

create table public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  snapshot jsonb not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  author_id uuid not null references auth.users (id),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.cooking_sessions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  started_by uuid references auth.users (id),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.cook_log (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  cooked_on date not null default current_date,
  session_id uuid references public.cooking_sessions (id) on delete set null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  cook_log_id uuid not null references public.cook_log (id) on delete cascade,
  member_id uuid not null references auth.users (id),
  stars int not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  unique (cook_log_id, member_id)
);

-- One row, updated daily by the keep-alive so the free project never pauses.
create table public.heartbeat (
  id int primary key default 1 check (id = 1),
  pinged_at timestamptz not null default now()
);
insert into public.heartbeat (id) values (1);

-- ---------------------------------------------------------------------------
-- Keep updated_at current (used for "latest change wins" sync)
-- ---------------------------------------------------------------------------

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger recipes_touch before update on public.recipes
  for each row execute function public.touch_updated_at();
create trigger ingredients_touch before update on public.ingredients
  for each row execute function public.touch_updated_at();
create trigger steps_touch before update on public.steps
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The signed-in person's kitchen, or null if they haven't joined one.
create function public.my_kitchen_id() returns uuid
language sql stable security definer set search_path = public as $$
  select kitchen_id from public.members where user_id = auth.uid()
$$;

create function public.recipe_in_my_kitchen(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.recipes
    where id = rid and kitchen_id = public.my_kitchen_id()
  )
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security: everyone only sees their own kitchen
-- ---------------------------------------------------------------------------

alter table public.kitchens enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.recipes enable row level security;
alter table public.ingredients enable row level security;
alter table public.steps enable row level security;
alter table public.recipe_versions enable row level security;
alter table public.notes enable row level security;
alter table public.cooking_sessions enable row level security;
alter table public.cook_log enable row level security;
alter table public.ratings enable row level security;
alter table public.heartbeat enable row level security;
-- heartbeat has no policies: only the keepalive() function touches it.

create policy "see own kitchen" on public.kitchens
  for select using (id = public.my_kitchen_id());
create policy "rename own kitchen" on public.kitchens
  for update using (id = public.my_kitchen_id());

create policy "see kitchen members" on public.members
  for select using (kitchen_id = public.my_kitchen_id());
create policy "edit own member row" on public.members
  for update using (user_id = auth.uid()) with check (kitchen_id = public.my_kitchen_id());

create policy "see own kitchen invites" on public.invites
  for select using (kitchen_id = public.my_kitchen_id());

create policy "recipes in own kitchen" on public.recipes
  for all using (kitchen_id = public.my_kitchen_id())
  with check (kitchen_id = public.my_kitchen_id());

create policy "ingredients in own kitchen" on public.ingredients
  for all using (public.recipe_in_my_kitchen(recipe_id))
  with check (public.recipe_in_my_kitchen(recipe_id));

create policy "steps in own kitchen" on public.steps
  for all using (public.recipe_in_my_kitchen(recipe_id))
  with check (public.recipe_in_my_kitchen(recipe_id));

create policy "versions in own kitchen" on public.recipe_versions
  for all using (public.recipe_in_my_kitchen(recipe_id))
  with check (public.recipe_in_my_kitchen(recipe_id));

-- Notes are insert-only: anyone in the kitchen can read and add,
-- and only the author can delete their own.
create policy "read notes" on public.notes
  for select using (public.recipe_in_my_kitchen(recipe_id));
create policy "add notes" on public.notes
  for insert with check (public.recipe_in_my_kitchen(recipe_id) and author_id = auth.uid());
create policy "delete own notes" on public.notes
  for delete using (author_id = auth.uid());

create policy "sessions in own kitchen" on public.cooking_sessions
  for all using (public.recipe_in_my_kitchen(recipe_id))
  with check (public.recipe_in_my_kitchen(recipe_id));

create policy "cook log in own kitchen" on public.cook_log
  for all using (public.recipe_in_my_kitchen(recipe_id))
  with check (public.recipe_in_my_kitchen(recipe_id));

create policy "read ratings" on public.ratings
  for select using (
    exists (select 1 from public.cook_log c
            where c.id = cook_log_id and public.recipe_in_my_kitchen(c.recipe_id))
  );
create policy "add or change own rating" on public.ratings
  for all using (member_id = auth.uid())
  with check (
    member_id = auth.uid() and exists (
      select 1 from public.cook_log c
      where c.id = cook_log_id and public.recipe_in_my_kitchen(c.recipe_id))
  );

-- ---------------------------------------------------------------------------
-- Kitchen setup functions (called from the app)
-- ---------------------------------------------------------------------------

-- First person: create the kitchen and join it.
create function public.create_kitchen(kitchen_name text, my_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  kid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception 'You are already in a kitchen';
  end if;
  insert into kitchens (name) values (kitchen_name) returning id into kid;
  insert into members (user_id, kitchen_id, display_name) values (auth.uid(), kid, my_name);
  return kid;
end $$;

-- Make a one-time invite code for the second person.
create function public.create_invite() returns text
language plpgsql security definer set search_path = public as $$
declare
  kid uuid := my_kitchen_id();
  new_code text;
begin
  if kid is null then raise exception 'Join a kitchen first'; end if;
  if (select count(*) from members where kitchen_id = kid) >= 2 then
    raise exception 'This kitchen already has two cooks';
  end if;
  new_code := encode(extensions.gen_random_bytes(9), 'base64');
  new_code := translate(new_code, '+/=', '-_');
  insert into invites (code, kitchen_id, created_by) values (new_code, kid, auth.uid());
  return new_code;
end $$;

-- Second person: join through an invite code.
create function public.join_kitchen(invite_code text, my_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv invites%rowtype;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception 'You are already in a kitchen';
  end if;
  select * into inv from invites where code = invite_code for update;
  if not found then raise exception 'That invite link is not valid'; end if;
  if inv.used_by is not null then raise exception 'That invite link was already used'; end if;
  if inv.expires_at < now() then raise exception 'That invite link has expired'; end if;
  if (select count(*) from members where kitchen_id = inv.kitchen_id) >= 2 then
    raise exception 'This kitchen already has two cooks';
  end if;
  insert into members (user_id, kitchen_id, display_name) values (auth.uid(), inv.kitchen_id, my_name);
  update invites set used_by = auth.uid(), used_at = now() where code = invite_code;
  return inv.kitchen_id;
end $$;

-- Daily keep-alive, called by Vercel's cron. Also empties Recently Deleted
-- of anything older than 30 days.
create function public.keepalive() returns void
language plpgsql security definer set search_path = public as $$
begin
  update heartbeat set pinged_at = now() where id = 1;
  delete from recipes where deleted_at is not null and deleted_at < now() - interval '30 days';
end $$;

revoke all on function public.create_kitchen(text, text) from public, anon;
revoke all on function public.create_invite() from public, anon;
revoke all on function public.join_kitchen(text, text) from public, anon;
grant execute on function public.create_kitchen(text, text) to authenticated;
grant execute on function public.create_invite() to authenticated;
grant execute on function public.join_kitchen(text, text) to authenticated;
grant execute on function public.keepalive() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Stats views (run with the caller's permissions, so RLS still applies)
-- ---------------------------------------------------------------------------

create view public.stats_most_made with (security_invoker = true) as
  select r.id as recipe_id, r.title, count(c.id) as times_made, max(c.cooked_on) as last_made
  from recipes r join cook_log c on c.recipe_id = r.id
  where r.deleted_at is null
  group by r.id, r.title;

-- Each person's most recent rating per recipe.
create view public.stats_latest_ratings with (security_invoker = true) as
  select distinct on (c.recipe_id, rt.member_id)
    c.recipe_id, rt.member_id, rt.stars, c.cooked_on
  from ratings rt join cook_log c on c.id = rt.cook_log_id
  order by c.recipe_id, rt.member_id, c.cooked_on desc, rt.created_at desc;

create view public.stats_cuisines with (security_invoker = true) as
  select coalesce(r.cuisine, 'Other') as cuisine, count(c.id) as times_made
  from cook_log c join recipes r on r.id = c.recipe_id
  group by coalesce(r.cuisine, 'Other');

create view public.stats_meal_types with (security_invoker = true) as
  select coalesce(r.meal_type, 'other') as meal_type, count(c.id) as times_made
  from cook_log c join recipes r on r.id = c.recipe_id
  group by coalesce(r.meal_type, 'other');

create view public.stats_ingredients with (security_invoker = true) as
  select i.item, count(*) as uses
  from cook_log c join ingredients i on i.recipe_id = c.recipe_id
  group by i.item;

-- Sessions count up to 4 hours each, so a screen left on overnight
-- doesn't inflate the total.
create view public.stats_hours with (security_invoker = true) as
  select coalesce(sum(least(extract(epoch from (s.ended_at - s.started_at)), 4 * 3600)), 0) / 3600.0
    as hours_together
  from cooking_sessions s
  where s.ended_at is not null;

-- ---------------------------------------------------------------------------
-- Storage for original screenshots and PDFs: one folder per kitchen
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('recipe-originals', 'recipe-originals', false);

create policy "kitchen files read" on storage.objects for select
  using (bucket_id = 'recipe-originals' and (storage.foldername(name))[1] = public.my_kitchen_id()::text);
create policy "kitchen files add" on storage.objects for insert
  with check (bucket_id = 'recipe-originals' and (storage.foldername(name))[1] = public.my_kitchen_id()::text);
create policy "kitchen files remove" on storage.objects for delete
  using (bucket_id = 'recipe-originals' and (storage.foldername(name))[1] = public.my_kitchen_id()::text);

-- ---------------------------------------------------------------------------
-- Realtime: send changes to the other phone as they happen
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.recipes, public.ingredients, public.steps, public.notes,
  public.cook_log, public.ratings, public.cooking_sessions, public.members;
