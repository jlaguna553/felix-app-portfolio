-- Allow products to be deleted even if they appear in historical orders.
-- order_items already stores unit_price and subtotal so financial data is preserved.
alter table public.order_items
  alter column product_id drop not null;

alter table public.order_items
  drop constraint if exists order_items_product_id_fkey;

alter table public.order_items
  add constraint order_items_product_id_fkey
    foreign key (product_id) references public.products(id) on delete set null;
