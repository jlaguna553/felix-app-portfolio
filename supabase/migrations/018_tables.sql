-- Physical table definitions (layout / seating plan)
-- Separate from 'tabs' which are order sessions.
create table public.tables (
  id         uuid primary key default gen_random_uuid(),
  number     int  not null unique check (number > 0),
  pos_x      float not null default 120,
  pos_y      float not null default 120,
  created_at timestamptz not null default now()
);

alter table public.tables enable row level security;

-- All authenticated users can read (POS / kitchen needs to know layout)
create policy "authenticated_read_tables" on public.tables
  for select using (auth.uid() is not null);

-- Only admins can create / move / delete tables
create policy "admin_write_tables" on public.tables
  for all using (is_admin());

alter publication supabase_realtime add table public.tables;
