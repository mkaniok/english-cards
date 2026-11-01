-- English Cards v2 schema
create type public.app_role as enum ('student', 'editor', 'admin');
create type public.card_status as enum ('pending', 'approved');
create type public.answer_grade as enum ('knew', 'partial', 'unknown');

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,          -- shared with pupils
  admin_code text not null unique,    -- secret, registers an admin
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  nickname text not null,
  login_slug text not null,
  role public.app_role not null default 'student',
  created_at timestamptz not null default now(),
  unique (class_id, login_slug)
);

create table public.textbooks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  textbook_id uuid not null references public.textbooks (id) on delete cascade,
  title text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.lessons (textbook_id);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  en text not null check (length(trim(en)) > 0),
  cz text not null check (length(trim(cz)) > 0),
  note text not null default '',
  status public.card_status not null default 'approved',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.cards (lesson_id);
create index on public.cards (created_by);

create table public.progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  dir text not null check (dir in ('en', 'cz')),
  level int not null default 0,
  seen int not null default 0,
  last_seen timestamptz,
  learned_at timestamptz,
  primary key (user_id, card_id, dir)
);
create index on public.progress (card_id);

create table public.answers (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  dir text not null check (dir in ('en', 'cz')),
  grade public.answer_grade not null,
  answered_at timestamptz not null default now()
);
create index on public.answers (user_id, answered_at);
create index on public.answers (card_id);

-- Helpers (security definer so policies can read the caller's profile without recursion)
create or replace function public.my_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function public.my_class() returns uuid
language sql stable security definer set search_path = '' as $$
  select class_id from public.profiles where id = (select auth.uid())
$$;

create or replace function public.is_editor() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role in ('editor', 'admin') from public.profiles where id = (select auth.uid())), false)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' from public.profiles where id = (select auth.uid())), false)
$$;

revoke execute on function public.my_role(), public.my_class(), public.is_editor(), public.is_admin() from anon, public;
grant execute on function public.my_role(), public.my_class(), public.is_editor(), public.is_admin() to authenticated;

-- RLS
alter table public.classes enable row level security;
alter table public.profiles enable row level security;
alter table public.textbooks enable row level security;
alter table public.lessons enable row level security;
alter table public.cards enable row level security;
alter table public.progress enable row level security;
alter table public.answers enable row level security;

-- classes: members see their class; admin_code is hidden via column grants below
create policy "members read own class" on public.classes for select to authenticated
  using (id = (select public.my_class()));
create policy "admin updates class" on public.classes for update to authenticated
  using (id = (select public.my_class()) and (select public.is_admin()));
revoke select, update on public.classes from authenticated, anon;
grant select (id, name, code, created_at) on public.classes to authenticated;
grant update (name) on public.classes to authenticated;

-- profiles
create policy "read own or classmates as editor" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or ((select public.is_editor()) and class_id = (select public.my_class())));
create policy "admin changes roles" on public.profiles for update to authenticated
  using ((select public.is_admin()) and class_id = (select public.my_class()))
  with check ((select public.is_admin()) and class_id = (select public.my_class()));
create policy "admin removes pupils" on public.profiles for delete to authenticated
  using ((select public.is_admin()) and class_id = (select public.my_class()) and id <> (select auth.uid()));
revoke insert, update on public.profiles from authenticated, anon;
grant update (role, nickname) on public.profiles to authenticated;

-- textbooks & lessons: everyone signed in reads, editors write
create policy "read textbooks" on public.textbooks for select to authenticated using (true);
create policy "editors write textbooks" on public.textbooks for all to authenticated
  using ((select public.is_editor())) with check ((select public.is_editor()));
create policy "read lessons" on public.lessons for select to authenticated using (true);
create policy "editors write lessons" on public.lessons for all to authenticated
  using ((select public.is_editor())) with check ((select public.is_editor()));

-- cards
create policy "read approved, own or as editor" on public.cards for select to authenticated
  using (status = 'approved' or created_by = (select auth.uid()) or (select public.is_editor()));
create policy "pupils suggest, editors add" on public.cards for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and ((select public.is_editor()) or (status = 'pending' and (select public.my_role()) is not null))
  );
create policy "editors update cards" on public.cards for update to authenticated
  using ((select public.is_editor())) with check ((select public.is_editor()));
create policy "editors or author of pending delete" on public.cards for delete to authenticated
  using ((select public.is_editor()) or (created_by = (select auth.uid()) and status = 'pending'));

-- progress & answers: own rows; editors read class rows for stats
create policy "own progress" on public.progress for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "editors read class progress" on public.progress for select to authenticated
  using ((select public.is_editor()) and user_id in (select id from public.profiles where class_id = (select public.my_class())));
create policy "own answers" on public.answers for select to authenticated
  using (user_id = (select auth.uid()));
create policy "insert own answers" on public.answers for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "editors read class answers" on public.answers for select to authenticated
  using ((select public.is_editor()) and user_id in (select id from public.profiles where class_id = (select public.my_class())));

-- Recording an answer: updates progress and logs the answer in one call.
-- knew: level + 1; partial: level stays; unknown: level back to 0. Learned = level >= 3.
create or replace function public.record_answer(p_card uuid, p_dir text, p_grade public.answer_grade)
returns int language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  cur int;
  nxt int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select level into cur from public.progress where user_id = uid and card_id = p_card and dir = p_dir;
  nxt := case p_grade when 'knew' then coalesce(cur, 0) + 1 when 'partial' then coalesce(cur, 0) else 0 end;
  insert into public.progress (user_id, card_id, dir, level, seen, last_seen, learned_at)
  values (uid, p_card, p_dir, nxt, 1, now(), case when nxt >= 3 then now() end)
  on conflict (user_id, card_id, dir) do update set
    level = excluded.level,
    seen = public.progress.seen + 1,
    last_seen = now(),
    learned_at = case when excluded.level >= 3 then coalesce(public.progress.learned_at, now()) else null end;
  insert into public.answers (user_id, card_id, dir, grade) values (uid, p_card, p_dir, p_grade);
  return nxt;
end $$;
revoke execute on function public.record_answer(uuid, text, public.answer_grade) from anon, public;
grant execute on function public.record_answer(uuid, text, public.answer_grade) to authenticated;

-- Keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger cards_touch before update on public.cards for each row execute function public.touch_updated_at();

-- Keep-alive ping target for the GitHub Action (free tier pauses after 7 idle days)
create or replace function public.ping() returns text language sql stable set search_path = '' as $$ select 'pong' $$;
grant execute on function public.ping() to anon, authenticated;
