-- Grants only. Safe to run more than once.
-- Run this if you ran an earlier copy of 0001_init.sql that didn't include
-- the "Table access for signed-in users" section. The full file can't be
-- run twice, because its tables already exist.

grant usage on schema public to anon, authenticated;

grant select, update on public.kitchens, public.members to authenticated;
grant select on public.invites to authenticated;
grant select, insert, update, delete on
  public.recipes, public.ingredients, public.steps, public.recipe_versions,
  public.cooking_sessions, public.cook_log, public.ratings
  to authenticated;
grant select, insert, delete on public.notes to authenticated;
grant select on
  public.stats_most_made, public.stats_latest_ratings, public.stats_cuisines,
  public.stats_meal_types, public.stats_ingredients, public.stats_hours
  to authenticated;
