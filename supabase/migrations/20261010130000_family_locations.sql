-- Live location: while "Share live location with parents" is on, the IRIS app keeps one row per
-- user up to date with where they are. Linked family members see it on the /family dashboard.
-- Turning sharing off deletes the row, so the family never sees a stale position as current.

create table public.iris_locations (
  user_id uuid primary key default auth.uid() references public.iris_profiles (id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m real,
  updated_at timestamptz not null default now()
);

-- The time comes from the database, not the phone's clock.
create function private.iris_stamp_location() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger iris_locations_stamp
  before insert or update on public.iris_locations
  for each row execute function private.iris_stamp_location();

alter table public.iris_locations enable row level security;

revoke all on public.iris_locations from anon, authenticated;
grant select, insert, delete on public.iris_locations to authenticated;
grant update (latitude, longitude, accuracy_m) on public.iris_locations to authenticated;

create policy "Locations: IRIS users share their own"
  on public.iris_locations for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.iris_profiles p where p.id = (select auth.uid()) and p.role = 'user')
  );

create policy "Locations: IRIS users update their own"
  on public.iris_locations for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Locations: IRIS users stop sharing"
  on public.iris_locations for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Locations: the user and their family can see them"
  on public.iris_locations for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.iris_family_links l
      where l.user_id = iris_locations.user_id and l.family_id = (select auth.uid())
    )
  );

alter publication supabase_realtime add table public.iris_locations;
