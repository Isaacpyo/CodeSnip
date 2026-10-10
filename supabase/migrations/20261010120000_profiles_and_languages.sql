-- Profiles (one per auth user) and the language lookup table.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  avatar_url text check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 500)),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Public-facing author info. One row per auth.users row, created by trigger.';
comment on column public.profiles.is_demo is 'Shared demo account: its password and email cannot be changed.';

-- Create a profile whenever a user signs up (email or OAuth).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  avatar text := meta ->> 'avatar_url';
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(
      nullif(btrim(meta ->> 'display_name'), ''),
      nullif(btrim(meta ->> 'full_name'), ''),
      nullif(btrim(meta ->> 'user_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ), 80),
    case when avatar ~ '^https://' and char_length(avatar) <= 500 then avatar end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The demo credentials are public, so stop anyone from locking everyone else
-- out by changing the demo account's password or email.
create function public.guard_demo_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.profiles p where p.id = old.id and p.is_demo)
     and (
       new.encrypted_password is distinct from old.encrypted_password
       or new.email is distinct from old.email
       or coalesce(new.email_change, '') not in ('', coalesce(old.email_change, ''))
     )
  then
    raise exception 'The demo account cannot be modified'
      using errcode = '42501', hint = 'Create your own account to change credentials.';
  end if;
  return new;
end;
$$;

create trigger guard_demo_user
  before update on auth.users
  for each row execute function public.guard_demo_user();

-- ---------------------------------------------------------------------------
-- languages: FK target for snippets.language. Ids are Monaco language ids.
-- Keep in sync with apps/web/src/lib/languages.ts (a DB test enforces this).
-- ---------------------------------------------------------------------------
create table public.languages (
  id text primary key check (id ~ '^[a-z0-9-]{1,32}$'),
  label text not null check (char_length(label) between 1 and 40)
);

insert into public.languages (id, label) values
  ('c', 'C'),
  ('cpp', 'C++'),
  ('csharp', 'C#'),
  ('css', 'CSS'),
  ('dart', 'Dart'),
  ('dockerfile', 'Dockerfile'),
  ('elixir', 'Elixir'),
  ('go', 'Go'),
  ('graphql', 'GraphQL'),
  ('html', 'HTML'),
  ('java', 'Java'),
  ('javascript', 'JavaScript'),
  ('json', 'JSON'),
  ('kotlin', 'Kotlin'),
  ('lua', 'Lua'),
  ('markdown', 'Markdown'),
  ('php', 'PHP'),
  ('plaintext', 'Plain text'),
  ('powershell', 'PowerShell'),
  ('python', 'Python'),
  ('r', 'R'),
  ('ruby', 'Ruby'),
  ('rust', 'Rust'),
  ('scala', 'Scala'),
  ('scss', 'SCSS'),
  ('shell', 'Shell'),
  ('sql', 'SQL'),
  ('swift', 'Swift'),
  ('typescript', 'TypeScript'),
  ('xml', 'XML'),
  ('yaml', 'YAML');

alter table public.languages enable row level security;
revoke all on public.languages from anon, authenticated;
grant select on public.languages to anon, authenticated;

create policy "Languages are readable by everyone"
  on public.languages for select
  to anon, authenticated
  using (true);
