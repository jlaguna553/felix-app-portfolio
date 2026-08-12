-- Allow waiters to manage table layout (add / move / delete)
-- Previously only admins could write; now waiters share that permission.
drop policy "admin_write_tables" on public.tables;

create policy "staff_write_tables" on public.tables
  for all using (
    is_admin()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'waiter'
    )
  );
