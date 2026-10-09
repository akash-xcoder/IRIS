-- Family alerts: IRIS users (blind or low-vision) and their family members, linked by a pairing
-- code. When an IRIS user falls or asks for help, the app inserts an alert; linked family members
-- see it live on the /family dashboard (Realtime) and can acknowledge and resolve it.

create schema if not exists private;

-- Profiles ------------------------------------------------------------------------------------

create table public.iris_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'family')),
  full_name text not null default '' check (char_length(full_name) <= 80),
  -- Only IRIS users have one. Family members type it in to link.
  link_code text unique check (link_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_at timestamptz not null default now()
);

-- Six characters from an alphabet without look-alikes (no 0/O, 1/I).
create function private.iris_new_link_code() returns text
language plpgsql
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.iris_profiles where link_code = code);
  end loop;
  return code;
end;
$$;

-- The role picked at sign-up only decides which screens the account sees; both roles have the
-- same privileges, and access to alerts comes from family_links, never from user metadata.
create function private.iris_handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r text := coalesce(new.raw_user_meta_data ->> 'role', 'user');
begin
  if r not in ('user', 'family') then
    r := 'user';
  end if;
  insert into public.iris_profiles (id, role, full_name, link_code)
  values (
    new.id,
    r,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 80),
    case when r = 'user' then private.iris_new_link_code() end
  );
  return new;
end;
$$;

create trigger on_auth_user_created_iris
  after insert on auth.users
  for each row execute function private.iris_handle_new_user();

-- Links ---------------------------------------------------------------------------------------

create table public.iris_family_links (
  user_id uuid not null references public.iris_profiles (id) on delete cascade,
  family_id uuid not null references public.iris_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, family_id)
);

create index iris_family_links_family_id_idx on public.iris_family_links (family_id);

-- Alerts --------------------------------------------------------------------------------------

create table public.iris_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.iris_profiles (id) on delete cascade,
  kind text not null check (kind in ('fall', 'help')),
  status text not null default 'active' check (status in ('active', 'acknowledged', 'resolved')),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  accuracy_m real,
  message text not null default '' check (char_length(message) <= 500),
  created_at timestamptz not null default now(),
  acknowledged_by uuid references public.iris_profiles (id) on delete set null,
  acknowledged_at timestamptz,
  resolved_by uuid references public.iris_profiles (id) on delete set null,
  resolved_at timestamptz
);

create index iris_alerts_user_id_created_at_idx on public.iris_alerts (user_id, created_at desc);
create index iris_alerts_acknowledged_by_idx on public.iris_alerts (acknowledged_by);
create index iris_alerts_resolved_by_idx on public.iris_alerts (resolved_by);

-- Who acknowledged or resolved an alert, and when, comes from the session, not the client.
create function private.iris_stamp_alert() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'acknowledged' and old.status = 'active' then
    new.acknowledged_by := auth.uid();
    new.acknowledged_at := now();
  elsif new.status = 'resolved' and old.status <> 'resolved' then
    new.resolved_by := auth.uid();
    new.resolved_at := now();
    if old.status = 'active' then
      new.acknowledged_by := auth.uid();
      new.acknowledged_at := now();
    end if;
  elsif new.status <> old.status then
    raise exception 'An alert can only move forward: active, acknowledged, resolved';
  end if;
  return new;
end;
$$;

create trigger iris_alerts_stamp
  before update on public.iris_alerts
  for each row execute function private.iris_stamp_alert();

-- Linking by code -------------------------------------------------------------------------------

-- A family member can't read other people's profiles, so looking up a code needs elevated rights.
-- It lives in the unexposed private schema and checks the caller itself.
create function private.iris_link_family(code text) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target uuid;
begin
  if me is null then
    raise exception 'Sign in first';
  end if;
  if not exists (select 1 from public.iris_profiles where id = me and role = 'family') then
    raise exception 'Only family accounts can link to an IRIS user';
  end if;
  select id into target
  from public.iris_profiles
  where link_code = upper(regexp_replace(code, '\s', '', 'g')) and role = 'user';
  if target is null then
    raise exception 'No IRIS user has that code';
  end if;
  insert into public.iris_family_links (user_id, family_id) values (target, me) on conflict do nothing;
  return target;
end;
$$;

revoke all on function private.iris_link_family(text) from public;
grant usage on schema private to authenticated;
grant execute on function private.iris_link_family(text) to authenticated;

-- The Data API entry point: runs as the caller and hands off to the checked function above.
create function public.iris_link_family(code text) returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.iris_link_family(code);
$$;

revoke all on function public.iris_link_family(text) from public, anon;
grant execute on function public.iris_link_family(text) to authenticated;

-- Row level security ----------------------------------------------------------------------------

alter table public.iris_profiles enable row level security;
alter table public.iris_family_links enable row level security;
alter table public.iris_alerts enable row level security;

revoke all on public.iris_profiles, public.iris_family_links, public.iris_alerts from anon, authenticated;
grant select on public.iris_profiles to authenticated;
grant update (full_name) on public.iris_profiles to authenticated;
grant select, delete on public.iris_family_links to authenticated;
grant select, insert on public.iris_alerts to authenticated;
grant update (status) on public.iris_alerts to authenticated;

create policy "Profiles: see yourself and the people you're linked with"
  on public.iris_profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.iris_family_links l
      where (l.user_id = iris_profiles.id and l.family_id = (select auth.uid()))
         or (l.family_id = iris_profiles.id and l.user_id = (select auth.uid()))
    )
  );

create policy "Profiles: edit your own name"
  on public.iris_profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Links: see your own"
  on public.iris_family_links for select to authenticated
  using (user_id = (select auth.uid()) or family_id = (select auth.uid()));

create policy "Links: either side can unlink"
  on public.iris_family_links for delete to authenticated
  using (user_id = (select auth.uid()) or family_id = (select auth.uid()));

create policy "Alerts: IRIS users raise their own"
  on public.iris_alerts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'active'
    and exists (select 1 from public.iris_profiles p where p.id = (select auth.uid()) and p.role = 'user')
  );

create policy "Alerts: the user and their family can see them"
  on public.iris_alerts for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.iris_family_links l
      where l.user_id = iris_alerts.user_id and l.family_id = (select auth.uid())
    )
  );

create policy "Alerts: the user and their family can respond"
  on public.iris_alerts for update to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.iris_family_links l
      where l.user_id = iris_alerts.user_id and l.family_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.iris_family_links l
      where l.user_id = iris_alerts.user_id and l.family_id = (select auth.uid())
    )
  );

-- Realtime: the dashboard subscribes to alerts; RLS above decides who receives each change.
alter publication supabase_realtime add table public.iris_alerts;
