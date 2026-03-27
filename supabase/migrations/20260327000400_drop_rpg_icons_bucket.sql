do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'rpg_icons_authenticated_read'
  ) then
    drop policy rpg_icons_authenticated_read on storage.objects;
  end if;
end
$$;

