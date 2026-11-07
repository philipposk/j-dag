-- DRAFT, not applied. Community-added J-dag bars in the existing 6x7 project.
create schema if not exists jdag;
create table jdag.community_bars (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  name_key text not null,                      -- folded name for dedupe
  address text not null check (char_length(address) between 1 and 200),
  source_url text check (source_url is null or (char_length(source_url) <= 500 and source_url ~ '^https?://')),
  lat double precision not null check (lat between 55.60 and 55.73),
  lng double precision not null check (lng between 12.45 and 12.65),
  osm_ref text,                                 -- e.g. node/123 from server geocode
  status text not null default 'visible' check (status in ('visible','hidden','removed')),
  idem_key text unique,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);
create table jdag.reports (
  id bigint generated always as identity primary key,
  bar_id uuid not null references jdag.community_bars(id) on delete cascade,
  reason text not null check (reason in ('closed','not_participating','wrong_place','spam','other')),
  note text check (note is null or char_length(note) <= 300),
  ip_hash text not null,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (bar_id, ip_hash)
);
create table jdag.rate_events (kind text not null, ip_hash text not null, at timestamptz not null default now());
create index on jdag.rate_events (kind, ip_hash, at);
alter table jdag.community_bars enable row level security;
alter table jdag.reports enable row level security;
alter table jdag.rate_events enable row level security;
-- No policies: only service role (server) touches the tables. Public read goes through this view.
create view jdag.public_bars with (security_invoker = false) as
  select id, name, address, source_url, lat, lng, created_at from jdag.community_bars where status = 'visible';
grant usage on schema jdag to anon;
grant select on jdag.public_bars to anon;
-- Rate check used by the API (service role): returns false when over the limit, else records the event.
create or replace function jdag.rate_hit(p_kind text, p_ip text, p_limit int, p_window interval)
returns boolean language plpgsql security definer set search_path = jdag as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_kind || p_ip));
  if (select count(*) from rate_events where kind = p_kind and ip_hash = p_ip and at > now() - p_window) >= p_limit then return false; end if;
  insert into rate_events(kind, ip_hash) values (p_kind, p_ip);
  delete from rate_events where at < now() - interval '2 days';
  return true;
end $$;
revoke all on function jdag.rate_hit from public, anon, authenticated;
-- Auto-hide at 3 distinct reporters.
create or replace function jdag.after_report() returns trigger language plpgsql security definer set search_path = jdag as $$
begin
  update community_bars set status = 'hidden' where id = new.bar_id and status = 'visible'
    and (select count(*) from reports where bar_id = new.bar_id) >= 3;
  return new;
end $$;
create trigger reports_hide after insert on jdag.reports for each row execute function jdag.after_report();
