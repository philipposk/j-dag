-- J-dag community-added bars. NOT YET APPLIED. Target: existing Supabase project "6x7" (fmrnqepyyjucnfbrqawl).
-- Design: tables live in private schema `jdag` (not exposed to the Data API, no anon/authenticated grants).
-- The j-dag server calls the public `jdag_*` RPCs with the service-role key (production only). Every RPC is
-- SECURITY INVOKER with an empty search_path, and EXECUTE is revoked from public/anon/authenticated.
-- No auto-hide: reports only notify; the owner hides/restores manually (see docs/missing-bar.md).
begin;
create schema if not exists jdag;
revoke all on schema jdag from public, anon, authenticated;
grant usage on schema jdag to service_role;

create table jdag.community_bars (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  name_key text not null check (char_length(name_key) between 1 and 120),
  address text not null check (char_length(address) between 1 and 200),
  source_url text check (source_url is null or (char_length(source_url) <= 500 and source_url ~ '^https?://[^\s<>"]+$')),
  lat double precision not null check (lat between 55.60 and 55.73),
  lng double precision not null check (lng between 12.45 and 12.65),
  osm_ref text check (osm_ref is null or osm_ref ~ '^(node|way|relation)/[0-9]{1,15}$'),
  status text not null default 'visible' check (status in ('visible','hidden','removed')),
  idem_key text not null unique check (char_length(idem_key) <= 80),
  submitter_hash text not null check (char_length(submitter_hash) = 64),
  created_at timestamptz not null default now()
);
create index on jdag.community_bars (status, created_at desc);
create table jdag.reports (
  id bigint generated always as identity primary key,
  bar_id uuid not null references jdag.community_bars(id) on delete cascade,
  reason text not null check (reason in ('closed','not_participating','wrong_place','spam','other')),
  note text check (note is null or char_length(note) <= 300),
  reporter_hash text not null check (char_length(reporter_hash) = 64),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (bar_id, reporter_hash)
);
create table jdag.rate_events (kind text not null, key_hash text not null, at timestamptz not null default now());
create index on jdag.rate_events (kind, key_hash, at);
create table jdag.geocache (q_key text primary key check (char_length(q_key) <= 220), result jsonb not null, at timestamptz not null default now());
create table jdag.nominatim_clock (id int primary key check (id = 1), last_at timestamptz not null);
insert into jdag.nominatim_clock values (1, 'epoch');

alter table jdag.community_bars enable row level security;
alter table jdag.reports enable row level security;
alter table jdag.rate_events enable row level security;
alter table jdag.geocache enable row level security;
alter table jdag.nominatim_clock enable row level security;
-- No policies on purpose: anon/authenticated get nothing. service_role bypasses RLS.
grant select, insert, update on all tables in schema jdag to service_role;
grant delete on jdag.rate_events, jdag.geocache to service_role;

-- Returns false when `key` already has `lim` events of `kind` within `window_s`, else records one.
create function public.jdag_rate_hit(p_kind text, p_key text, p_limit int, p_window_s int)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('jdag_rate:' || p_kind || ':' || p_key, 0));
  if (select count(*) from jdag.rate_events where kind = p_kind and key_hash = p_key
      and at > now() - make_interval(secs => p_window_s)) >= p_limit then return false; end if;
  insert into jdag.rate_events(kind, key_hash) values (p_kind, p_key);
  return true;
end $$;

-- Global 1 request/second gate for Nominatim (usage policy). True = caller may make one request now.
create function public.jdag_nominatim_slot()
returns boolean language sql security invoker set search_path = '' as $$
  with u as (update jdag.nominatim_clock set last_at = now() where id = 1 and last_at < now() - interval '1100 milliseconds' returning 1)
  select exists (select 1 from u);
$$;
create function public.jdag_geocache_get(p_key text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select result from jdag.geocache where q_key = p_key and at > now() - interval '30 days';
$$;
create function public.jdag_geocache_put(p_key text, p_result jsonb)
returns void language sql security invoker set search_path = '' as $$
  insert into jdag.geocache(q_key, result) values (p_key, p_result)
  on conflict (q_key) do update set result = excluded.result, at = now();
$$;

-- Inserts a community bar unless it duplicates one (same folded name within 150 m, or same OSM element).
-- Serialized with an advisory lock so two concurrent identical submissions cannot both insert.
create function public.jdag_add_bar(p_name text, p_name_key text, p_address text, p_source_url text,
  p_lat double precision, p_lng double precision, p_osm_ref text, p_idem_key text, p_submitter_hash text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare existing jdag.community_bars; new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('jdag_add_bar', 0));
  select * into existing from jdag.community_bars where idem_key = p_idem_key;
  if found then return jsonb_build_object('status', 'added', 'id', existing.id, 'repeat', true); end if;
  select * into existing from jdag.community_bars b where b.status <> 'removed' and (
    (p_osm_ref is not null and b.osm_ref = p_osm_ref) or
    (b.name_key = p_name_key and 6371000 * sqrt(power(radians(b.lat - p_lat), 2) +
      power(radians(b.lng - p_lng) * cos(radians(p_lat)), 2)) < 150)) limit 1;
  if found then return jsonb_build_object('status', 'duplicate', 'id', existing.id, 'name', existing.name); end if;
  if (select count(*) from jdag.community_bars where status = 'visible') >= 1000 then return jsonb_build_object('status', 'full'); end if;
  insert into jdag.community_bars(name, name_key, address, source_url, lat, lng, osm_ref, idem_key, submitter_hash)
  values (p_name, p_name_key, p_address, nullif(p_source_url, ''), p_lat, p_lng, p_osm_ref, p_idem_key, p_submitter_hash)
  returning id into new_id;
  return jsonb_build_object('status', 'added', 'id', new_id);
end $$;

-- Public list (sanitized columns only), bounded.
create function public.jdag_list_bars(p_limit int default 500)
returns table (id uuid, name text, address text, source_url text, lat double precision, lng double precision, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select id, name, address, source_url, lat, lng, created_at from jdag.community_bars
  where status = 'visible' order by created_at desc limit least(greatest(coalesce(p_limit, 500), 1), 1000);
$$;

-- Stores a report (one per reporter per bar). Never hides anything.
create function public.jdag_add_report(p_bar_id uuid, p_reason text, p_note text, p_reporter_hash text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare bar jdag.community_bars; rid bigint;
begin
  select * into bar from jdag.community_bars where id = p_bar_id and status = 'visible';
  if not found then return jsonb_build_object('status', 'missing'); end if;
  insert into jdag.reports(bar_id, reason, note, reporter_hash) values (p_bar_id, p_reason, nullif(p_note, ''), p_reporter_hash)
  on conflict (bar_id, reporter_hash) do nothing returning id into rid;
  if rid is null then return jsonb_build_object('status', 'duplicate'); end if;
  return jsonb_build_object('status', 'added', 'report_id', rid, 'bar_name', bar.name, 'bar_address', bar.address);
end $$;
create function public.jdag_mark_report_notified(p_report_id bigint)
returns void language sql security invoker set search_path = '' as $$
  update jdag.reports set notified_at = now() where id = p_report_id;
$$;

do $$ declare f text; begin
  foreach f in array array['jdag_rate_hit(text,text,int,int)','jdag_nominatim_slot()','jdag_geocache_get(text)',
    'jdag_geocache_put(text,jsonb)','jdag_add_bar(text,text,text,text,double precision,double precision,text,text,text)',
    'jdag_list_bars(int)','jdag_add_report(uuid,text,text,text)','jdag_mark_report_notified(bigint)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- Daily cleanup of rate counters and old geocode cache (pg_cron is already installed in this project).
select cron.schedule('jdag-cleanup', '17 3 * * *',
  $$delete from jdag.rate_events where at < now() - interval '2 days'; delete from jdag.geocache where at < now() - interval '30 days';$$);
commit;
