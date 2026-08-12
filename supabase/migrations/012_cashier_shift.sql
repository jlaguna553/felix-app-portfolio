-- Shift status: open (turno activo) | closed (corte realizado)
alter table public.shifts
  add column if not exists status text not null default 'closed'
    check (status in ('open', 'closed'));

-- closed_at may be null while shift is open
alter table public.shifts
  alter column closed_at drop not null;

alter table public.shifts
  alter column closed_at drop default;

-- Helper to check cashier role (mirrors is_admin pattern)
create or replace function public.is_cashier()
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'cashier'
  );
$$;

-- Allow cashiers to manage shifts too
drop policy if exists "admin_all_shifts" on public.shifts;

create policy "admin_or_cashier_shifts" on public.shifts
  for all using (is_admin() or is_cashier());

-- Allow cashiers to read orders (needed for caja feed)
create policy "cashier_read_orders" on public.orders
  for select using (is_cashier());

-- Enable realtime for shifts if not already
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'shifts'
  ) then
    alter publication supabase_realtime add table public.shifts;
  end if;
end$$;
