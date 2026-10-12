-- Full-text search and facet RPCs. Both are SECURITY INVOKER, so RLS on
-- snippets/profiles applies exactly as it would to a direct table read.

-- Turn free text into a prefix-matching tsquery: "use debou" -> 'use':* & 'debou':*
-- Only [alnum_] runs survive, so user input can never inject tsquery syntax.
-- Returns null when nothing searchable is left (empty input, only stop words).
create function public.to_prefix_tsquery(input text)
returns tsquery
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case when tq is null or numnode(tq) = 0 then null else tq end
  from (
    select to_tsquery('english', string_agg(word || ':*', ' & ' order by ord)) as tq
    from (
      select word, ord
      from regexp_split_to_table(lower(coalesce(input, '')), '[^[:alnum:]_]+') with ordinality as w(word, ord)
      where word <> ''
      order by ord
      limit 10
    ) as words
  ) as q
$$;

create function public.search_snippets(
  search text default '',
  tag_filter text[] default '{}',
  lang text default null,
  scope text default 'mine',
  page_size integer default 24,
  page_offset integer default 0
)
returns table (
  id uuid,
  owner_id uuid,
  title text,
  description text,
  code_preview text,
  language text,
  tags text[],
  visibility text,
  created_at timestamptz,
  updated_at timestamptz,
  author_name text,
  author_avatar_url text,
  rank real,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  ts tsquery := public.to_prefix_tsquery(search);
  -- escape LIKE wildcards so the title fallback is a literal substring match
  title_pattern text := '%' || replace(replace(replace(btrim(coalesce(search, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  wanted_tags text[] := coalesce(
    (select array_agg(distinct lower(btrim(t))) from unnest(tag_filter) as t where btrim(t) <> ''),
    '{}'
  );
  uid uuid := auth.uid();
  lim integer := least(greatest(coalesce(page_size, 24), 1), 100);
  skip integer := greatest(coalesce(page_offset, 0), 0);
begin
  if scope is null or scope not in ('mine', 'public') then
    raise exception 'scope must be "mine" or "public"' using errcode = '22023';
  end if;

  return query
  select
    s.id,
    s.owner_id,
    s.title,
    s.description,
    left(s.code, 600),
    s.language,
    s.tags,
    s.visibility,
    s.created_at,
    s.updated_at,
    p.display_name,
    p.avatar_url,
    (case when ts is null then 0 else ts_rank(s.search_vector, ts) end)::real,
    count(*) over ()
  from public.snippets as s
  left join public.profiles as p on p.id = s.owner_id
  where (case when scope = 'mine' then s.owner_id = uid else s.visibility = 'public' end)
    and (
      btrim(coalesce(search, '')) = ''
      or (ts is not null and s.search_vector @@ ts)
      or s.title ilike title_pattern
    )
    and (cardinality(wanted_tags) = 0 or s.tags @> wanted_tags)
    and (coalesce(lang, '') = '' or s.language = lang)
  order by 13 desc, s.updated_at desc, s.id
  limit lim
  offset skip;
end;
$$;

comment on function public.search_snippets is
  'Ranked full-text search over snippets visible to the caller. scope: mine | public.';

create function public.snippet_facets(scope text default 'mine')
returns table (kind text, value text, count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with visible as (
    select s.tags, s.language
    from public.snippets as s
    where case snippet_facets.scope
      when 'mine' then s.owner_id = (select auth.uid())
      when 'public' then s.visibility = 'public'
      else false
    end
  )
  select 'tag', t, count(*) from visible, unnest(visible.tags) as t group by t
  union all
  select 'language', v.language, count(*) from visible as v group by v.language
  order by 1, 3 desc, 2
$$;

comment on function public.snippet_facets is
  'Tag and language counts over snippets visible to the caller, for filter sidebars.';

revoke execute on function public.search_snippets(text, text[], text, text, integer, integer) from public;
revoke execute on function public.snippet_facets(text) from public;
grant execute on function public.search_snippets(text, text[], text, text, integer, integer) to anon, authenticated;
grant execute on function public.snippet_facets(text) to anon, authenticated;
