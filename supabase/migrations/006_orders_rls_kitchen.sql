-- La política waiter_read_own_orders sólo dejaba ver pedidos propios.
-- Cocina y admin deben poder leer todos los pedidos.

drop policy if exists "waiter_read_own_orders" on public.orders;

-- Mesero ve los suyos; cocina y admin ven todos
create policy "read_orders" on public.orders
  for select using (
    auth.uid() = created_by
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'kitchen')
    )
  );
