-- Five cook colors: berry, orange, green, ocean, violet.
-- Only needed if 0014 was run before it listed these five. Safe to run
-- either way: it maps the earlier colors to their nearest new one and
-- replaces the check.

alter table public.members drop constraint if exists members_color_check;

-- Map in an order that can't collide with the one-color-each rule:
-- coral -> berry, blue -> ocean, magenta -> violet (green stays green).
update public.members set color = 'berry' where color = 'coral';
update public.members set color = 'ocean' where color = 'blue';
update public.members set color = 'violet' where color = 'magenta';
update public.members set color = null
  where color is not null and color not in ('berry', 'orange', 'green', 'ocean', 'violet');

alter table public.members add constraint members_color_check
  check (color is null or color in ('berry', 'orange', 'green', 'ocean', 'violet'));
