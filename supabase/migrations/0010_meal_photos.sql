-- Photos of finished dishes, one per cook per meal (a recipe on a date).
-- Phones shrink each photo to about 300 KB before uploading. The limits
-- below keep the free 1 GB of storage from filling by accident:
--   - each file is at most 500 KB and must be a JPEG (bucket settings)
--   - one photo per cook per meal (a new one replaces the old)
--   - at most 500 photos per kitchen (about 150 MB)

create table if not exists public.meal_photos (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  cooked_on date not null,
  path text not null,
  bytes int not null check (bytes > 0 and bytes <= 512000),
  width int,
  height int,
  added_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create unique index if not exists meal_photos_one_each
  on public.meal_photos (recipe_id, cooked_on, added_by);

alter table public.meal_photos enable row level security;

drop policy if exists "see kitchen photos" on public.meal_photos;
create policy "see kitchen photos" on public.meal_photos
  for select using (public.recipe_in_my_kitchen(recipe_id));
drop policy if exists "add own photos" on public.meal_photos;
create policy "add own photos" on public.meal_photos
  for insert with check (added_by = auth.uid() and public.recipe_in_my_kitchen(recipe_id));
drop policy if exists "remove kitchen photos" on public.meal_photos;
create policy "remove kitchen photos" on public.meal_photos
  for delete using (public.recipe_in_my_kitchen(recipe_id));

grant select, insert, delete on public.meal_photos to authenticated;

-- At most 500 photos per kitchen.
create or replace function public.meal_photos_limit()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  kid uuid;
  total int;
begin
  select kitchen_id into kid from recipes where id = new.recipe_id;
  select count(*) into total
  from meal_photos p join recipes r on r.id = p.recipe_id
  where r.kitchen_id = kid;
  if total >= 500 then
    raise exception 'Photo limit reached: this kitchen has 500 photos. Remove some to add more.';
  end if;
  return new;
end $$;

drop trigger if exists meal_photos_limit on public.meal_photos;
create trigger meal_photos_limit before insert on public.meal_photos
  for each row execute function public.meal_photos_limit();

-- The files, in a private bucket. Each kitchen's photos sit in a folder
-- named after the kitchen, so only its cooks can read or change them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 512000, array['image/jpeg'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "kitchen photos read" on storage.objects;
create policy "kitchen photos read" on storage.objects for select
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = public.my_kitchen_id()::text);
drop policy if exists "kitchen photos add" on storage.objects;
create policy "kitchen photos add" on storage.objects for insert
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = public.my_kitchen_id()::text);
drop policy if exists "kitchen photos remove" on storage.objects;
create policy "kitchen photos remove" on storage.objects for delete
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = public.my_kitchen_id()::text);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meal_photos'
  ) then
    alter publication supabase_realtime add table public.meal_photos;
  end if;
end $$;
