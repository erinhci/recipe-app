-- Time cooking together now comes from each recipe's total time, added
-- once per logged meal. Cooking mode no longer times sessions, so the
-- cooking_sessions table and its link from the cook log are removed.
-- Run after both phones have updated to 0.16.0; older versions still
-- read this table and would show a sync error until they update.
-- Safe to run more than once.

drop view if exists public.stats_hours;
alter table public.cook_log drop column if exists session_id;
drop table if exists public.cooking_sessions;
