-- The cheers pose (unlocked by 5 two-chef cooks) for the kitchen's scene.
-- Safe to run more than once: it replaces the check on duo_pose.

alter table public.kitchens drop constraint if exists kitchens_duo_pose_check;
alter table public.kitchens add constraint kitchens_duo_pose_check
  check (duo_pose in ('wave', 'highfive', 'taste', 'cheers'));
