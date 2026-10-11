-- Our Kitchen: removing a cook, or leaving a kitchen.
-- Run once in the Supabase SQL editor, after 0001_init.sql.
--
-- A removed cook's membership is marked removed instead of deleted, so their
-- past notes and ratings keep their name. They lose access right away and
-- can start or join another kitchen afterwards.

-- Memberships get their own id, so one person can have a removed
-- membership in one kitchen and an active one in another.
alter table public.members drop constraint members_pkey;
alter table public.members add column id uuid not null default gen_random_uuid();
alter table public.members add primary key (id);
alter table public.members add column removed_at timestamptz;
alter table public.members add column removed_by uuid references auth.users (id);
create unique index members_one_active_kitchen on public.members (user_id) where removed_at is null;

-- Only active memberships count from here on.
create or replace function public.my_kitchen_id() returns uuid
language sql stable security definer set search_path = public as $$
  select kitchen_id from public.members where user_id = auth.uid() and removed_at is null
$$;

create or replace function public.create_kitchen(kitchen_name text, my_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  kid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if my_kitchen_id() is not null then
    raise exception 'You are already in a kitchen';
  end if;
  insert into kitchens (name) values (kitchen_name) returning id into kid;
  insert into members (user_id, kitchen_id, display_name) values (auth.uid(), kid, my_name);
  return kid;
end $$;

create or replace function public.create_invite() returns text
language plpgsql security definer set search_path = public as $$
declare
  kid uuid := my_kitchen_id();
  new_code text;
begin
  if kid is null then raise exception 'Join a kitchen first'; end if;
  if (select count(*) from members where kitchen_id = kid and removed_at is null) >= 2 then
    raise exception 'This kitchen already has two cooks';
  end if;
  new_code := encode(extensions.gen_random_bytes(9), 'base64');
  new_code := translate(new_code, '+/=', '-_');
  insert into invites (code, kitchen_id, created_by) values (new_code, kid, auth.uid());
  return new_code;
end $$;

create or replace function public.join_kitchen(invite_code text, my_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv invites%rowtype;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if my_kitchen_id() is not null then
    raise exception 'You are already in a kitchen';
  end if;
  select * into inv from invites where code = invite_code for update;
  if not found then raise exception 'That invite link is not valid'; end if;
  if inv.used_by is not null then raise exception 'That invite link was already used'; end if;
  if inv.expires_at < now() then raise exception 'That invite link has expired'; end if;
  if (select count(*) from members where kitchen_id = inv.kitchen_id and removed_at is null) >= 2 then
    raise exception 'This kitchen already has two cooks';
  end if;
  insert into members (user_id, kitchen_id, display_name) values (auth.uid(), inv.kitchen_id, my_name);
  update invites set used_by = auth.uid(), used_at = now() where code = invite_code;
  return inv.kitchen_id;
end $$;

-- Remove a cook from your kitchen. Passing your own id leaves the kitchen.
create function public.remove_member(member_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  kid uuid := my_kitchen_id();
begin
  if kid is null then raise exception 'You are not in a kitchen'; end if;
  update members
     set removed_at = now(), removed_by = auth.uid()
   where user_id = member_user_id and kitchen_id = kid and removed_at is null;
  if not found then raise exception 'That cook is not in your kitchen'; end if;
  -- Any unused invite links stop working, so a fresh link is needed.
  update invites set expires_at = now()
   where kitchen_id = kid and used_by is null and expires_at > now();
end $$;

revoke all on function public.remove_member(uuid) from public, anon;
grant execute on function public.remove_member(uuid) to authenticated;

-- Cooks can change only their own name and unit preference, so nobody can
-- edit removed_at directly.
revoke update on public.members from authenticated;
grant update (display_name, unit_pref) on public.members to authenticated;
