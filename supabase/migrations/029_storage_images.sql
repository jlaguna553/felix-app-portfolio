-- Storage bucket for uploaded images (logos, products)
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'images');

create policy "Public read access to images"
on storage.objects for select
to public
using (bucket_id = 'images');

create policy "Authenticated users can update images"
on storage.objects for update
to authenticated
using (bucket_id = 'images');

create policy "Authenticated users can delete images"
on storage.objects for delete
to authenticated
using (bucket_id = 'images');
