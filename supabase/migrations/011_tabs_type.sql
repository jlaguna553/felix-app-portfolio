-- Tipo de tab: mesa fisica o pedido de cliente/para llevar
alter table public.tabs
  add column if not exists type text not null default 'table'
  check (type in ('table', 'client'));

-- Habilitar realtime si no está activado
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'tabs'
  ) then
    alter publication supabase_realtime add table public.tabs;
  end if;
end$$;
