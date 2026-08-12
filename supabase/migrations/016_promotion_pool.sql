-- Pool-mode promotions: count total of all eligible products toward a shared quantity
-- When pool_quantity is set, times = floor(sum_of_all_listed_products / pool_quantity)
-- instead of requiring exact per-product counts.
alter table public.promotions
  add column if not exists pool_quantity int check (pool_quantity > 0);
