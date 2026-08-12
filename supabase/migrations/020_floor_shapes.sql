-- Decorative / structural shapes for the interactive floor plan
-- These have no order logic; they are purely visual (walls, bars, rooms, etc.)
create table public.floor_shapes (
  id         uuid    primary key default gen_random_uuid(),
  label      text    not null default '',
  pos_x      float   not null default 100,
  pos_y      float   not null default 100,
  width      float   not null default 180,
  height     float   not null default 110,
  fill       text    not null default '#f0e8d8',
  created_at timestamptz not null default now()
);

alter table public.floor_shapes enable row level security;

create policy "authenticated_read_shapes" on public.floor_shapes
  for select using (auth.uid() is not null);

create policy "staff_write_shapes" on public.floor_shapes
  for all using (
    is_admin()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'waiter'
    )
  );

alter publication supabase_realtime add table public.floor_shapes;
