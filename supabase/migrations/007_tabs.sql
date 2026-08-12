-- Mesas/clientes activos: agrupan múltiples rondas de pedidos
create table public.tabs (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  opened_by  uuid not null references auth.users(id),
  opened_at  timestamptz not null default now(),
  status     text not null default 'open' check (status in ('open', 'closed')),
  closed_at  timestamptz
);

alter table public.tabs enable row level security;

create policy "auth_read_tabs"   on public.tabs for select using (auth.role() = 'authenticated');
create policy "auth_insert_tabs" on public.tabs for insert with check (auth.role() = 'authenticated');
create policy "auth_update_tabs" on public.tabs for update
  using  (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Vincular pedidos a una mesa
alter table public.orders add column if not exists tab_id uuid references public.tabs(id);

-- Realtime para el selector de mesas
alter publication supabase_realtime add table public.tabs;
