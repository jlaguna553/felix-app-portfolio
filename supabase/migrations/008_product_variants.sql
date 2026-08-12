-- Variantes opcionales por producto (ej. Gordita → ["Queso","Migajas"])
alter table public.products
  add column if not exists variants text[] default null;
