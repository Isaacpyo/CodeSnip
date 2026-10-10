-- Snippets: the core table, its write-time normalisation, quota guard,
-- indexes, column grants and row level security.

-- Tags: at most 10, each lowercase, 1-32 chars, starting with a letter/digit.
create function public.tags_are_valid(tags text[])
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select cardinality(tags) <= 10
     and coalesce(bool_and(t is not null and t ~ '^[a-z0-9][a-z0-9_.+#-]{0,31}$'), true)
  from unnest(tags) as t
$$;

create table public.snippets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  code text not null check (char_length(code) between 1 and 100000),
  language text not null default 'plaintext' references public.languages (id),
  tags text[] not null default '{}' check (public.tags_are_valid(tags)),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector not null default ''::tsvector
);

comment on table public.snippets is 'Code snippets. Private rows are visible to their owner only; public rows to everyone.';
comment on column public.snippets.search_vector is 'Maintained by trigger: title (A), description + tags (B), language (C), code (D).';

-- Split camelCase / PascalCase so "useDebounce" is also indexed as "use debounce".
create function public.split_identifiers(input text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select input || ' ' || regexp_replace(input, '([[:lower:][:digit:]])([[:upper:]])', '\1 \2', 'g')
$$;

-- Normalise user input and rebuild the search vector on every write.
create function public.snippets_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title := btrim(new.title);
  new.description := btrim(coalesce(new.description, ''));
  -- trim + lowercase + drop blanks + de-duplicate, keeping first-seen order
  new.tags := coalesce((
    select array_agg(tag order by first_seen)
    from (
      select lower(btrim(raw)) as tag, min(ord) as first_seen
      from unnest(new.tags) with ordinality as u(raw, ord)
      where raw is not null and btrim(raw) <> ''
      group by lower(btrim(raw))
    ) as deduped
  ), '{}');

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;

  new.search_vector :=
       setweight(to_tsvector('english', public.split_identifiers(new.title)), 'A')
    || setweight(to_tsvector('english', new.description), 'B')
    || setweight(to_tsvector('simple', array_to_string(new.tags, ' ')), 'B')
    || setweight(to_tsvector('simple', new.language), 'C')
    || setweight(to_tsvector('simple', public.split_identifiers(left(new.code, 20000))), 'D');
  return new;
end;
$$;

create trigger snippets_before_write
  before insert or update on public.snippets
  for each row execute function public.snippets_before_write();

-- Abuse guard: cap snippets per account. Statement-level so a bulk import is
-- checked once, not once per row.
create function public.enforce_snippet_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.snippets s
    where s.owner_id in (select distinct owner_id from inserted)
    group by s.owner_id
    having count(*) > 2000
  ) then
    raise exception 'Snippet limit reached: each account can store up to 2000 snippets'
      using errcode = '54000';
  end if;
  return null;
end;
$$;

create trigger snippets_quota
  after insert on public.snippets
  referencing new table as inserted
  for each statement execute function public.enforce_snippet_quota();

create index snippets_owner_updated_idx on public.snippets (owner_id, updated_at desc);
create index snippets_public_updated_idx on public.snippets (updated_at desc) where visibility = 'public';
create index snippets_search_idx on public.snippets using gin (search_vector);
create index snippets_tags_idx on public.snippets using gin (tags);

-- ---------------------------------------------------------------------------
-- Privileges. Supabase grants ALL on new public tables to anon/authenticated by
-- default; replace that with the minimum. owner_id, timestamps and the search
-- vector are never writable through the API.
-- ---------------------------------------------------------------------------
revoke all on public.snippets from anon, authenticated;
grant select on public.snippets to anon, authenticated;
grant insert (title, description, code, language, tags, visibility) on public.snippets to authenticated;
grant update (title, description, code, language, tags, visibility) on public.snippets to authenticated;
grant delete on public.snippets to authenticated;

alter table public.snippets enable row level security;

create policy "Public snippets are readable by anyone"
  on public.snippets for select
  to anon, authenticated
  using (visibility = 'public');

create policy "Owners can read their own snippets"
  on public.snippets for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Users can create snippets they own"
  on public.snippets for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Owners can update their own snippets"
  on public.snippets for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Owners can delete their own snippets"
  on public.snippets for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------------------
-- profiles privileges + RLS (defined here because the read policy looks at
-- snippets). A profile is visible to its owner, and to everyone once that user
-- has published something, so display names of private users never leak.
-- ---------------------------------------------------------------------------
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Authors of public snippets are readable by anyone"
  on public.profiles for select
  to anon, authenticated
  using (exists (
    select 1 from public.snippets s
    where s.owner_id = profiles.id and s.visibility = 'public'
  ));

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
