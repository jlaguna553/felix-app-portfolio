-- ============================================================
-- Gorditas Doña Félix — Schema inicial
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- Profiles (extendido de auth.users)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        text not null check (role in ('admin', 'waiter')) default 'waiter',
  pin_code    text,
  created_at  timestamptz default now()
);

-- Categorías de productos
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  emoji       text,
  sort_order  int default 0,
  created_at  timestamptz default now()
);

-- Productos del menú
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sale_price  numeric(10,2) not null,
  category_id uuid references public.categories(id) on delete set null,
  image_url   text,
  is_active   boolean default true,
  created_at  timestamptz default now()
);

-- Insumos / inventario
create table public.supplies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  unit          text not null check (unit in ('gr', 'ml', 'pza')),
  current_stock numeric(12,3) default 0,
  min_stock     numeric(12,3) default 0,
  unit_cost     numeric(10,4) default 0,
  created_at    timestamptz default now()
);

-- Recetas: relación producto ↔ insumo con cantidad
create table public.recipes (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  supply_id   uuid not null references public.supplies(id) on delete cascade,
  quantity    numeric(12,3) not null check (quantity > 0),
  unique(product_id, supply_id)
);

-- Órdenes
create table public.orders (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  created_by   uuid not null references public.profiles(id),
  total_amount numeric(10,2) not null,
  status       text not null check (status in ('pending', 'paid', 'cancelled')) default 'pending'
);

-- Ítems de cada orden
create table public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  product_id  uuid not null references public.products(id),
  quantity    int not null check (quantity > 0),
  unit_price  numeric(10,2) not null,
  subtotal    numeric(10,2) not null
);

-- ============================================================
-- TRIGGER: Descuento automático de inventario al vender
-- ============================================================
create or replace function deduct_inventory()
returns trigger language plpgsql as $$
begin
  update public.supplies s
  set current_stock = s.current_stock - (r.quantity * NEW.quantity)
  from public.recipes r
  where r.product_id = NEW.product_id
    and r.supply_id  = s.id;

  return NEW;
end;
$$;

create trigger trg_deduct_inventory
after insert on public.order_items
for each row execute function deduct_inventory();

-- ============================================================
-- TRIGGER: Crear perfil automáticamente al registrar usuario
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.email),
    coalesce(NEW.raw_user_meta_data->>'role', 'waiter')
  );
  return NEW;
end;
$$;

create trigger trg_on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

-- ============================================================
-- VIEW: Margen de utilidad por producto
-- ============================================================
create or replace view public.product_margins as
select
  p.id   as product_id,
  p.name,
  p.sale_price,
  coalesce(
    sum(r.quantity * s.unit_cost), 0
  )                                        as cost,
  p.sale_price - coalesce(
    sum(r.quantity * s.unit_cost), 0
  )                                        as margin,
  case
    when p.sale_price = 0 then 0
    else round(
      (p.sale_price - coalesce(sum(r.quantity * s.unit_cost), 0)) / p.sale_price * 100,
      2
    )
  end                                      as margin_percent
from public.products p
left join public.recipes r on r.product_id = p.id
left join public.supplies s on s.id = r.supply_id
group by p.id, p.name, p.sale_price;

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
alter table public.profiles    enable row level security;
alter table public.categories  enable row level security;
alter table public.products    enable row level security;
alter table public.supplies    enable row level security;
alter table public.recipes     enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Profiles: cada usuario ve el suyo; admin ve todos
create policy "users_own_profile" on public.profiles
  for select using (auth.uid() = id);

create policy "admin_all_profiles" on public.profiles
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Categories, Products: todos pueden leer; solo admin modifica
create policy "all_read_categories" on public.categories
  for select using (auth.role() = 'authenticated');

create policy "admin_write_categories" on public.categories
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "all_read_products" on public.products
  for select using (auth.role() = 'authenticated');

create policy "admin_write_products" on public.products
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Supplies, Recipes: solo admin
create policy "admin_all_supplies" on public.supplies
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "admin_all_recipes" on public.recipes
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Orders: meseros insertan y leen las suyas; admin lee todas
create policy "waiter_insert_orders" on public.orders
  for insert with check (auth.uid() = created_by);

create policy "waiter_read_own_orders" on public.orders
  for select using (auth.uid() = created_by);

create policy "admin_all_orders" on public.orders
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Order items: cualquier usuario autenticado puede insertar y leer
create policy "auth_insert_order_items" on public.order_items
  for insert with check (auth.role() = 'authenticated');

create policy "auth_read_order_items" on public.order_items
  for select using (auth.role() = 'authenticated');
