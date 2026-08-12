-- Promociones / combos con descuento automático
create table public.promotions (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text,
  discount_type  text not null check (discount_type in ('fixed', 'percent')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  schedule_type  text not null default 'all_day' check (schedule_type in ('all_day', 'window')),
  start_time     time,
  end_time       time,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  constraint promotions_window_check check (
    schedule_type = 'all_day'
    or (schedule_type = 'window' and start_time is not null and end_time is not null)
  )
);

-- Productos requeridos para activar la promoción
create table public.promotion_items (
  id            uuid primary key default gen_random_uuid(),
  promotion_id  uuid not null references public.promotions(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  quantity      int not null default 1 check (quantity > 0),
  unique(promotion_id, product_id)
);

-- Descuento aplicado por pedido
alter table public.orders
  add column if not exists discount_amount numeric(10,2) not null default 0;

alter table public.promotions      enable row level security;
alter table public.promotion_items enable row level security;

-- Todos los usuarios autenticados pueden leer (POS necesita las promos)
create policy "read_promotions" on public.promotions
  for select using (auth.uid() is not null);

create policy "read_promotion_items" on public.promotion_items
  for select using (auth.uid() is not null);

-- Solo admins pueden escribir
create policy "admin_all_promotions" on public.promotions
  for all using (is_admin());

create policy "admin_all_promotion_items" on public.promotion_items
  for all using (is_admin());

alter publication supabase_realtime add table public.promotions;
