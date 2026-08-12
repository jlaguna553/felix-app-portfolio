-- Historial de cortes de caja
create table public.shifts (
  id               uuid primary key default gen_random_uuid(),
  opened_at        timestamptz not null,
  closed_at        timestamptz not null default now(),
  closed_by        uuid references auth.users(id),
  total_orders     int  not null default 0,
  paid_orders      int  not null default 0,
  cancelled_orders int  not null default 0,
  total_revenue    numeric(10,2) not null default 0,
  notes            text
);

alter table public.shifts enable row level security;

-- Solo admins ven y gestionan cortes
create policy "admin_all_shifts" on public.shifts
  for all using (is_admin());
