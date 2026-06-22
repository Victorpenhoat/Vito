create function public.is_admin() returns boolean
  language sql security definer set search_path = '' stable as $$
  select coalesce(auth.jwt() ->> 'user_role', '') = 'admin';
$$;

-- subscriptions : aujourd'hui select-own (00011). Policy permissive admin-read ajoutée.
create policy "subscriptions_select_admin" on public.subscriptions for select
  using (public.is_admin());

revoke execute on function public.is_admin() from anon, public;
grant execute on function public.is_admin() to authenticated;
