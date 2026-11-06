-- Multiple classes.
-- * A class is grade + letter + school year (e.g. 6. D, 2026/2027). The year is a separate field so
--   next year's 6. D is a different class; moving a class up a year is just an edit (pupils keep logins).
-- * Admins (teachers) manage ALL classes: create them, see their codes, members and stats.
--   Editors stay limited to their own class. Cards and lessons are shared by every class.
-- * The pupil code of a class never changes: it is part of each pupil's internal login.

-- Random codes from an unambiguous alphabet (no 0/O, 1/I/L), using the 122 random bits of a v4 UUID.
create or replace function public.random_code(len int) returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  b bytea := uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid());
  out text := '';
begin
  for i in 0 .. len - 1 loop
    out := out || substr(alphabet, 1 + get_byte(b, i) % length(alphabet), 1);
  end loop;
  return out;
end $$;
revoke execute on function public.random_code(int) from anon, public;
grant execute on function public.random_code(int) to authenticated;

alter table public.classes
  add column grade smallint check (grade between 1 and 13),
  add column letter text check (letter ~ '^[A-Z]{1,2}$'),
  add column school_year smallint check (school_year between 2020 and 2100); -- 2026 = 2026/2027

-- The existing class becomes 6. D 2026/2027 (its code stays, so pupils keep logging in as before).
update public.classes set grade = 6, letter = 'D', school_year = 2026;

alter table public.classes
  alter column grade set not null,
  alter column letter set not null,
  alter column school_year set not null,
  alter column code set default public.random_code(6),
  alter column admin_code set default public.random_code(12),
  add constraint classes_grade_letter_year_key unique (grade, letter, school_year);

alter table public.classes drop column name;
alter table public.classes add column name text generated always as (grade::text || '. ' || letter) stored;

-- classes: members see their class, admins see and manage all of them
drop policy "members read own class" on public.classes;
drop policy "admin updates class" on public.classes;
create policy "members read own class, admins all" on public.classes for select to authenticated
  using (id = (select public.my_class()) or (select public.is_admin()));
create policy "admins create classes" on public.classes for insert to authenticated
  with check ((select public.is_admin()));
create policy "admins update classes" on public.classes for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke select, insert, update on public.classes from authenticated, anon;
grant select (id, name, grade, letter, school_year, code, created_at) on public.classes to authenticated;
grant insert (grade, letter, school_year) on public.classes to authenticated;
grant update (grade, letter, school_year) on public.classes to authenticated;

-- profiles: admins see and manage members of every class
drop policy "read own or classmates as editor" on public.profiles;
drop policy "admin changes roles" on public.profiles;
drop policy "admin removes pupils" on public.profiles;
create policy "read own, classmates as editor, all as admin" on public.profiles for select to authenticated
  using (id = (select auth.uid())
    or ((select public.is_editor()) and class_id = (select public.my_class()))
    or (select public.is_admin()));
create policy "admin changes roles" on public.profiles for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin removes pupils" on public.profiles for delete to authenticated
  using ((select public.is_admin()) and id <> (select auth.uid()));

-- progress & answers: admins read every class for stats
drop policy "editors read class progress" on public.progress;
create policy "editors read class progress, admins all" on public.progress for select to authenticated
  using ((select public.is_admin())
    or ((select public.is_editor()) and user_id in (select id from public.profiles where class_id = (select public.my_class()))));
drop policy "editors read class answers" on public.answers;
create policy "editors read class answers, admins all" on public.answers for select to authenticated
  using ((select public.is_admin())
    or ((select public.is_editor()) and user_id in (select id from public.profiles where class_id = (select public.my_class()))));
