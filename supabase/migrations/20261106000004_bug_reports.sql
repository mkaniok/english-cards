-- Bug reports sent from the app ("Nahlásit chybu").
-- Everyone signed in can report; the reporter sees their own reports, the super admin sees and resolves all.
create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 3 and 2000),
  page text not null default '' check (char_length(page) <= 300),
  device text not null default '' check (char_length(device) <= 500),
  errors text not null default '' check (char_length(errors) <= 4000),  -- last JS errors caught in the browser
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index bug_reports_created_at on public.bug_reports (created_at desc);
create index bug_reports_user_id on public.bug_reports (user_id);

alter table public.bug_reports enable row level security;

create policy "report own bugs" on public.bug_reports for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'new' and resolved_at is null);
create policy "read own bugs, all as super admin" on public.bug_reports for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_superadmin()));
create policy "super admin resolves bugs" on public.bug_reports for update to authenticated
  using ((select public.is_superadmin())) with check ((select public.is_superadmin()));
create policy "super admin deletes bugs" on public.bug_reports for delete to authenticated
  using ((select public.is_superadmin()));

revoke all on public.bug_reports from anon;
revoke update on public.bug_reports from authenticated;
grant select, insert, delete on public.bug_reports to authenticated;
grant update (status, resolved_at) on public.bug_reports to authenticated;
