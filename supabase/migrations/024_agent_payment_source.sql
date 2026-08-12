-- Allow orders created by the AI agent to be identified
alter table public.orders
  drop constraint if exists orders_payment_source_check;

alter table public.orders
  add constraint orders_payment_source_check
    check (payment_source in ('pos', 'caja', 'agent'));
