-- ============================================================
-- Datos de prueba para Gorditas Doña Félix
-- Ejecutar DESPUÉS de la migración inicial
-- ============================================================

-- ============================================================
-- Usuario owner para desarrollo local
-- Login: owner@felix.local / felix123
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'owner@felix.local') THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, is_sso_user,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, phone, phone_change, phone_change_token,
      reauthentication_token
    ) VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'owner@felix.local',
      crypt('felix123', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Dueño Local","role":"owner"}'::jsonb,
      now(), now(), false,
      '', '', '', '', '', '', '', ''
    );
    -- El trigger trg_on_auth_user_created crea el perfil automáticamente
  END IF;
END $$;

-- Categorías
insert into public.categories (name, emoji, sort_order) values
  ('Gorditas', '🫓', 1),
  ('Bebidas', '🥤', 2),
  ('Paquetes', '📦', 3),
  ('Extras', '🌶️', 4);

-- Insumos
insert into public.supplies (name, unit, current_stock, min_stock, unit_cost) values
  ('Masa de maíz',     'gr',  5000, 500,  0.015),
  ('Guiso de frijol',  'gr',  2000, 200,  0.040),
  ('Guiso de chicharrón', 'gr', 1500, 150, 0.060),
  ('Guiso de rajas',   'gr',  1200, 100,  0.035),
  ('Queso Oaxaca',     'gr',  1000, 100,  0.120),
  ('Crema',            'ml',  800,  100,  0.025),
  ('Salsa verde',      'ml',  600,  50,   0.020),
  ('Agua mineral',     'pza', 50,   10,   6.000),
  ('Refresco lata',    'pza', 30,   6,    9.500),
  ('Servilletas',      'pza', 200,  50,   0.100);

-- Productos
insert into public.products (name, sale_price, category_id, is_active)
select 'Gordita de Frijol', 18.00, id, true from public.categories where name = 'Gorditas';

insert into public.products (name, sale_price, category_id, is_active)
select 'Gordita de Chicharrón', 20.00, id, true from public.categories where name = 'Gorditas';

insert into public.products (name, sale_price, category_id, is_active)
select 'Gordita de Rajas con Queso', 22.00, id, true from public.categories where name = 'Gorditas';

insert into public.products (name, sale_price, category_id, is_active)
select 'Agua Mineral', 12.00, id, true from public.categories where name = 'Bebidas';

insert into public.products (name, sale_price, category_id, is_active)
select 'Refresco', 15.00, id, true from public.categories where name = 'Bebidas';

insert into public.products (name, sale_price, category_id, is_active)
select 'Paquete 3 Gorditas + Refresco', 60.00, id, true from public.categories where name = 'Paquetes';

-- Recetas (explosión de insumos)
-- Gordita de Frijol: 60gr masa + 50gr guiso frijol + 10ml crema
insert into public.recipes (product_id, supply_id, quantity)
select p.id, s.id, 60 from public.products p, public.supplies s where p.name = 'Gordita de Frijol' and s.name = 'Masa de maíz';
insert into public.recipes (product_id, supply_id, quantity)
select p.id, s.id, 50 from public.products p, public.supplies s where p.name = 'Gordita de Frijol' and s.name = 'Guiso de frijol';
insert into public.recipes (product_id, supply_id, quantity)
select p.id, s.id, 10 from public.products p, public.supplies s where p.name = 'Gordita de Frijol' and s.name = 'Crema';

-- Gordita de Chicharrón: 60gr masa + 50gr guiso chicharrón + 10ml salsa
insert into public.recipes (product_id, supply_id, quantity)
select p.id, s.id, 60 from public.products p, public.supplies s where p.name = 'Gordita de Chicharrón' and s.name = 'Masa de maíz';
insert into public.recipes (product_id, supply_id, quantity)
select p.id, s.id, 50 from public.products p, public.supplies s where p.name = 'Gordita de Chicharrón' and s.name = 'Guiso de chicharrón';
insert into public.recipes (product_id, supply_id, quantity)
select p.id, s.id, 10 from public.products p, public.supplies s where p.name = 'Gordita de Chicharrón' and s.name = 'Salsa verde';

-- Gordita de Rajas con Queso: 60gr masa + 45gr guiso rajas + 30gr queso
insert into public.recipes (product_id, supply_id, quantity)
select p.id, s.id, 60 from public.products p, public.supplies s where p.name = 'Gordita de Rajas con Queso' and s.name = 'Masa de maíz';
insert into public.recipes (product_id, supply_id, quantity)
select p.id, s.id, 45 from public.products p, public.supplies s where p.name = 'Gordita de Rajas con Queso' and s.name = 'Guiso de rajas';
insert into public.recipes (product_id, supply_id, quantity)
select p.id, s.id, 30 from public.products p, public.supplies s where p.name = 'Gordita de Rajas con Queso' and s.name = 'Queso Oaxaca';

-- Agua Mineral: 1 pza
insert into public.recipes (product_id, supply_id, quantity)
select p.id, s.id, 1 from public.products p, public.supplies s where p.name = 'Agua Mineral' and s.name = 'Agua mineral';

-- Refresco: 1 pza
insert into public.recipes (product_id, supply_id, quantity)
select p.id, s.id, 1 from public.products p, public.supplies s where p.name = 'Refresco' and s.name = 'Refresco lata';
