-- Explicit "pide cuenta" signal from the waiter.
-- Set when the waiter marks a table as requesting the bill;
-- cleared automatically when the tab is closed (cobrar).
alter table public.tabs
  add column if not exists billing_requested_at timestamptz;
