-- Separate who opened a shift from who closed it.
-- Previously, handleStart() incorrectly stored the opener's ID in closed_by.
alter table public.shifts
  add column if not exists opened_by uuid references auth.users(id);
