-- After the first two-chef test (egg bites):
--   1. Both phones in a two-chef cook use the same servings, so their
--      amounts match. The first phone to open the cook sets it; either
--      cook can change it.
--   2. Ratings allow half stars (0.5 to 5, in steps of 0.5).
-- Run once in the Supabase SQL editor. Safe to run more than once.

-- 1. Shared servings ---------------------------------------------------------

alter table public.two_chef_cooks add column if not exists servings numeric
  check (servings is null or servings > 0);

-- start_two_chef now takes the opening phone's servings.
drop function if exists public.start_two_chef(uuid);
create or replace function public.start_two_chef(p_recipe uuid, p_servings numeric default null)
returns public.two_chef_cooks
language plpgsql security definer set search_path = public as $$
declare
  c two_chef_cooks;
begin
  if not recipe_in_my_kitchen(p_recipe) then raise exception 'Recipe not found'; end if;
  update two_chef_cooks set ended_at = now(), updated_at = now()
    where recipe_id = p_recipe and ended_at is null and started_at < now() - interval '6 hours';
  insert into two_chef_cooks (recipe_id, servings) values (p_recipe, p_servings)
    on conflict (recipe_id) where ended_at is null do nothing;
  select * into c from two_chef_cooks where recipe_id = p_recipe and ended_at is null;
  return c;
end $$;

create or replace function public.set_servings(p_cook uuid, p_servings numeric)
returns public.two_chef_cooks
language plpgsql security definer set search_path = public as $$
declare
  c two_chef_cooks;
begin
  if p_servings is null or p_servings <= 0 then raise exception 'Servings must be above 0'; end if;
  select * into c from two_chef_cooks where id = p_cook for update;
  if not found or not recipe_in_my_kitchen(c.recipe_id) then raise exception 'Cook not found'; end if;
  update two_chef_cooks set servings = p_servings, updated_at = now()
    where id = p_cook returning * into c;
  return c;
end $$;

grant execute on function public.start_two_chef(uuid, numeric) to authenticated;
grant execute on function public.set_servings(uuid, numeric) to authenticated;

-- 2. Half-star ratings -------------------------------------------------------

-- The stats view reads ratings.stars, so it's set aside while the column
-- changes, then put back as it was.
drop view if exists public.stats_latest_ratings;

alter table public.ratings drop constraint if exists ratings_stars_check;
alter table public.ratings alter column stars type numeric(2, 1);
alter table public.ratings add constraint ratings_stars_check
  check (stars >= 0.5 and stars <= 5 and stars * 2 = round(stars * 2));

create view public.stats_latest_ratings with (security_invoker = true) as
  select distinct on (c.recipe_id, rt.member_id)
    c.recipe_id, rt.member_id, rt.stars, c.cooked_on
  from ratings rt join cook_log c on c.id = rt.cook_log_id
  order by c.recipe_id, rt.member_id, c.cooked_on desc, rt.created_at desc;
grant select on public.stats_latest_ratings to authenticated;
