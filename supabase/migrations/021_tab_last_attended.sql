-- Track when a waiter last attended (delivered food to) each table.
-- Used by the floor plan to show a distinct "served" state vs "ready to deliver".
alter table public.tabs
  add column if not exists last_attended_at timestamptz;
