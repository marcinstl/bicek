insert into storage.buckets (id, name, public)
values ('rpg-icons', 'rpg-icons', false)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'rpg_icons_authenticated_read'
  ) then
    create policy rpg_icons_authenticated_read
      on storage.objects
      for select
      to authenticated
      using (bucket_id = 'rpg-icons');
  end if;
end
$$;
