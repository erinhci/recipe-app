-- Earlier versions of recipes are no longer kept. The recipe_versions table
-- now only holds short records of which note changed a recipe, so the note
-- can show what it changed and can't be used twice.
-- This removes the stored recipe copies. Safe to run more than once.

delete from public.recipe_versions where snapshot->'next_change' is null;

update public.recipe_versions
  set snapshot = jsonb_build_object('next_change', snapshot->'next_change')
  where snapshot ? 'recipe';
