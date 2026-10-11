-- Nutrition estimates, saved with each recipe so both phones see them
-- and Gemini isn't asked again on every view. Safe to run more than once.
--
-- Shape (written by the app):
--   { items: [{ number, calories, protein_g, carbs_g, fat_g, assumption }],
--     notes, based_on, estimated_at, estimated_by }
-- based_on is the ingredient list and servings the estimate was made from,
-- so the app can tell when the recipe has changed since.

alter table public.recipes add column if not exists nutrition jsonb;
