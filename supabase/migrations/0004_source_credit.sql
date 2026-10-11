-- Keep who a recipe is credited to, and stop keeping imported originals.
-- Safe to run more than once.
--
-- source_name: the site, book, or person a recipe is credited to.
-- Imported screenshots and PDFs are no longer saved after review, so the
-- old links to them are cleared. (The files themselves are removed from
-- Storage in the dashboard: Storage > recipe-originals > select all > Delete.)

alter table public.recipes add column if not exists source_name text;

update public.recipes set original_file = null where original_file is not null;
