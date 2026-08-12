-- ============================================================
-- Órdenes v2: número de pedido, estados extendidos, mesa, notas
-- ============================================================

-- Número de pedido legible (auto-incremental)
alter table public.orders add column if not exists order_number serial;
alter table public.orders add column if not exists table_number  text;
alter table public.orders add column if not exists notes         text;

-- Ampliar estados: pending → preparing → ready → paid | cancelled
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'preparing', 'ready', 'paid', 'cancelled'));

-- Notas por ítem (ej. "sin cebolla")
alter table public.order_items add column if not exists notes text;

-- Activar Realtime para cocina
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;

-- Permitir que cualquier autenticado actualice el status (mesero/cocina/admin)
create policy "auth_update_order_status" on public.orders
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
