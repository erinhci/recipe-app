-- Ingredient sections: a recipe's ingredient list can have parts, like
-- "Filling" and "Sauce", so a step that says "add the sauce ingredients"
-- can show them. Null means the ingredient isn't in a named section.
alter table public.ingredients add column if not exists section text
  check (section is null or char_length(section) between 1 and 60);
