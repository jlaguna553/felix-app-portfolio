-- Track which module processed the payment
alter table public.orders
  add column if not exists payment_source text
    check (payment_source in ('pos', 'caja'));
