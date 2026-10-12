-- A record of each cook: how many servings were made, changes made while
-- cooking, and nutrition for what was actually made. The recipe itself
-- stays as written; a change can be turned into a recipe change later.

-- Servings made, and the nutrition estimate for this cook.
alter table public.cook_log add column if not exists servings numeric(6,2)
  check (servings is null or servings > 0);
alter table public.cook_log add column if not exists nutrition jsonb;

-- A note with a date is a change made while cooking that day.
alter table public.notes add column if not exists cooked_on date;
