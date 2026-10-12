-- Prep and cook time on each recipe, shown before cooking so the cooks
-- can plan when to start things (like preheating) themselves.
-- total_time_minutes stays; it's what Stats counts per meal.
-- Run once in the Supabase SQL editor. Safe to run more than once.

alter table public.recipes add column if not exists prep_minutes int
  check (prep_minutes is null or prep_minutes > 0);
alter table public.recipes add column if not exists cook_minutes int
  check (cook_minutes is null or cook_minutes > 0);
