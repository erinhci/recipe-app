-- More than one photo per meal. Each cook could add one photo per meal
-- (a new one replaced the old). Now anyone in the kitchen can add several,
-- up to 20 per recipe. The kitchen-wide limit of 500 stays, so storage
-- still can't fill by accident (500 x about 300 KB is about 150 MB of the
-- free 1 GB).

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
  select count(*) into for_recipe from meal_photos where recipe_id = new.recipe_id;
  if for_recipe >= 20 then
    raise exception 'Photo limit reached: this recipe has 20 photos. Remove one to add another.';
  end if;
  return new;
end $$;
