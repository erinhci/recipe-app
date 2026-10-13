-- More than one photo per meal. Each cook could add one photo per meal
-- (a new one replaced the old). Now each cook can add up to 3 photos per
-- recipe, on any of its meals, so a recipe has at most 6 (about 2 MB) and
-- both cooks get the same share. The kitchen-wide limit of 500 stays.
-- Safe to run again: it only drops, creates if missing, and replaces.

drop index if exists public.meal_photos_one_each;
create index if not exists meal_photos_recipe_idx on public.meal_photos (recipe_id);

create or replace function public.meal_photos_limit()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  kid uuid;
  total int;
  for_recipe int;
begin
  select kitchen_id into kid from recipes where id = new.recipe_id;
  select count(*) into total
  from meal_photos p join recipes r on r.id = p.recipe_id
  where r.kitchen_id = kid;
  if total >= 500 then
    raise exception 'Photo limit reached: this kitchen has 500 photos. Remove some to add more.';
  end if;
  select count(*) into for_recipe from meal_photos
  where recipe_id = new.recipe_id and added_by = new.added_by;
  if for_recipe >= 3 then
    raise exception 'Photo limit reached: you have 3 photos on this recipe. Remove one to add another.';
  end if;
  return new;
end $$;
