-- Breakdown Desk schema. Run in the Supabase SQL editor (idempotent: drops and recreates).

drop table if exists records, actions, decisions, incident_events, incidents,
  loads, warranty_policies, shops, trucks cascade;

-- ───────────── Reference data ─────────────

create table trucks (
  id               text primary key,            -- e.g. 'T3847'
  unit_number      text not null unique,        -- e.g. '3847'
  make             text not null,
  model            text not null,
  year             int  not null,
  odometer_miles   int  not null,
  in_service_date  date not null
);

create table shops (
  id           text primary key,
  name         text not null,
  type         text not null check (type in ('oem_dealer', 'independent', 'tire')),
  oem_make     text,                            -- brand served, for oem_dealer only
  city         text not null,
  state        text not null,
  lat          double precision not null,
  lng          double precision not null,
  capabilities text[] not null,                 -- engine | aftertreatment | drivetrain | brakes | tires | towing
  in_network   boolean not null default false,
  labor_rate   numeric(6,2) not null            -- USD per hour
);

create table warranty_policies (
  id         text primary key,
  component  text not null unique check (component in ('engine', 'aftertreatment', 'drivetrain', 'tires')),
  max_miles  int not null,
  max_months int not null
);

create table loads (
  id                 text primary key,
  truck_id           text not null references trucks(id),
  customer           text not null,
  origin             text not null,
  destination        text not null,
  delivery_deadline  timestamptz not null
);

-- ───────────── Runtime data ─────────────

create table incidents (
  id          uuid primary key default gen_random_uuid(),
  truck_id    text references trucks(id),
  source      text not null check (source in ('geotab', 'samsara', 'driver')),
  raw_payload jsonb not null,
  spn         int,
  fmi         int,
  description text,
  location    text,
  lat         double precision,
  lng         double precision,
  severity    text check (severity in ('stop_now', 'limp_to_shop', 'schedule_later')),
  status      text not null default 'open',
  created_at  timestamptz not null default now()
);

-- The live feed. Realtime enabled below.
create table incident_events (
  id          bigint generated always as identity primary key,
  incident_id uuid not null references incidents(id) on delete cascade,
  created_at  timestamptz not null default now(),
  layer       text not null check (layer in ('signals', 'units', 'decisions', 'counterparties', 'actions', 'records')),
  status      text not null,                    -- e.g. RECEIVED, ROUTING, LIVE, DONE, PENDING
  message     text not null
);
create index on incident_events (incident_id, created_at);

-- The audit trail: one row per decision.
create table decisions (
  id             uuid primary key default gen_random_uuid(),
  incident_id    uuid not null references incidents(id) on delete cascade,
  name           text not null,                 -- severity | tow_need | shop_set | recoverable
  output         jsonb not null,
  source         text not null check (source in ('rule', 'llm', 'human')),
  reason         text,
  inputs         jsonb,
  needs_approval boolean not null default false,
  created_at     timestamptz not null default now()
);
create index on decisions (incident_id, created_at);

create table actions (
  id          uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  type        text not null check (type in ('shop_booking', 'driver_sms', 'warranty_claim')),
  recipient   text not null,
  body        text not null,
  status      text not null default 'pending' check (status in ('pending', 'approved')),
  created_at  timestamptz not null default now(),
  approved_at timestamptz
);

create table records (
  id          uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  type        text not null check (type in ('repair_order', 'claim_line')),
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);

-- ───────────── Security + Realtime ─────────────
-- All server code uses the service role key (bypasses RLS). The browser uses the
-- anon key only to subscribe to incident_events, so that is the one table with an
-- anon read policy. Everything else is locked down.

alter table trucks            enable row level security;
alter table shops             enable row level security;
alter table warranty_policies enable row level security;
alter table loads             enable row level security;
alter table incidents         enable row level security;
alter table incident_events   enable row level security;
alter table decisions         enable row level security;
alter table actions           enable row level security;
alter table records           enable row level security;

create policy "anon can read incident_events"
  on incident_events for select to anon using (true);

alter publication supabase_realtime add table incident_events;
