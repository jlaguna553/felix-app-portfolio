-- Tabla de configuración general del restaurante
create table public.settings (
  key        text primary key,
  value      text,
  updated_at timestamptz default now()
);

-- Valores por defecto
insert into public.settings (key, value) values
  ('restaurant_name',     'Gorditas Doña Félix'),
  ('restaurant_logo_url', ''),
  ('restaurant_tagline',  'Sistema POS & ERP');

-- RLS: solo admin puede leer y escribir
alter table public.settings enable row level security;

create policy "admin_all_settings" on public.settings
  for all using (is_admin());

create policy "auth_read_settings" on public.settings
  for select using (auth.role() = 'authenticated');
