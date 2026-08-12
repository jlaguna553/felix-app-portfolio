-- ============================================================
-- Fix: infinite recursion en políticas de RLS
-- El problema: las políticas consultaban public.profiles
-- desde dentro de una política de public.profiles → loop.
-- Solución: función SECURITY DEFINER que bypass RLS.
-- ============================================================

-- Eliminar políticas que causan recursión
drop policy if exists "admin_all_profiles"      on public.profiles;
drop policy if exists "admin_write_categories"  on public.categories;
drop policy if exists "admin_all_supplies"      on public.supplies;
drop policy if exists "admin_all_recipes"       on public.recipes;
drop policy if exists "admin_write_products"    on public.products;
drop policy if exists "admin_all_orders"        on public.orders;

-- Función que lee el rol sin activar RLS (security definer)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Recrear políticas usando la función
create policy "admin_all_profiles" on public.profiles
  for all using (is_admin());

create policy "admin_write_categories" on public.categories
  for all using (is_admin());

create policy "admin_all_supplies" on public.supplies
  for all using (is_admin());

create policy "admin_all_recipes" on public.recipes
  for all using (is_admin());

create policy "admin_write_products" on public.products
  for all using (is_admin());

create policy "admin_all_orders" on public.orders
  for all using (is_admin());
