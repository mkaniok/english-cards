-- Super admin counts as editor and admin everywhere.
create or replace function public.is_editor() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role in ('editor', 'admin', 'superadmin') from public.profiles where id = (select auth.uid())), false)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role in ('admin', 'superadmin') from public.profiles where id = (select auth.uid())), false)
$$;

create or replace function public.is_superadmin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'superadmin' from public.profiles where id = (select auth.uid())), false)
$$;
revoke execute on function public.is_superadmin() from anon, public;
grant execute on function public.is_superadmin() to authenticated;

-- Admins manage everyone except super admins, and cannot hand out the super admin role.
drop policy "admin changes roles" on public.profiles;
create policy "admin changes roles" on public.profiles for update to authenticated
  using ((select public.is_admin()) and ((select public.is_superadmin()) or role <> 'superadmin'))
  with check ((select public.is_admin()) and ((select public.is_superadmin()) or role <> 'superadmin'));
drop policy "admin removes pupils" on public.profiles;
create policy "admin removes pupils" on public.profiles for delete to authenticated
  using ((select public.is_admin()) and id <> (select auth.uid())
    and ((select public.is_superadmin()) or role <> 'superadmin'));
