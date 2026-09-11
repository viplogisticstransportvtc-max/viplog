create extension if not exists pgcrypto;

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(), token_hash text not null unique,
  admin_id text not null, expires_at timestamptz not null, created_at timestamptz not null default now()
);
create table if not exists public.drivers (
  id text primary key, name text not null, rank text not null default 'Driver', flag text not null default '🌍', km text not null default '0 KM', created_at timestamptz not null default now()
);
create table if not exists public.fleet (
  id text primary key, make text not null, model text not null, image text not null default '', created_at timestamptz not null default now()
);
create table if not exists public.convoys (
  id text primary key, name text not null, date text not null default '', time text not null default '', "from" text not null default '', "to" text not null default '', server text not null default 'Simulation 1', distance text not null default '', created_at timestamptz not null default now()
);
create table if not exists public.news (
  id text primary key, category text not null default 'VTC News', date text not null default '', title text not null, description text not null default '', created_at timestamptz not null default now()
);
create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(), title text not null, image_url text not null,
  category text not null default 'VTC', description text not null default '', sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists admin_sessions_token_idx on public.admin_sessions(token_hash);
create index if not exists admin_sessions_expiry_idx on public.admin_sessions(expires_at);
create index if not exists drivers_created_idx on public.drivers(created_at desc);
create index if not exists fleet_created_idx on public.fleet(created_at desc);
create index if not exists convoys_created_idx on public.convoys(created_at desc);
create index if not exists news_created_idx on public.news(created_at desc);
create index if not exists gallery_sort_idx on public.gallery(sort_order, created_at desc);

alter table public.admin_sessions enable row level security;
alter table public.drivers enable row level security;
alter table public.fleet enable row level security;
alter table public.convoys enable row level security;
alter table public.news enable row level security;
alter table public.gallery enable row level security;

-- Server-side API uses SUPABASE_SERVICE_ROLE_KEY. Do not expose that key in Vite/browser code.

-- Seed the initial demo content once. These statements are safe to re-run.
insert into public.drivers (id,name,rank,flag,km) values
('VIP-001','John Driver','Senior Driver','🇬🇧','25,430 KM'),
('VIP-014','Alex Roads','Professional Driver','🇬🇭','21,810 KM'),
('VIP-027','Mike Transit','Driver','🇩🇪','18,620 KM'),
('VIP-041','Daniel Haul','Junior Driver','🇳🇱','12,450 KM')
on conflict (id) do nothing;
insert into public.fleet (id,make,model,image) values
('VIP-001','Scania','S Series','https://images.unsplash.com/photo-1601584115197-04ecc0da31d8?auto=format&fit=crop&w=1000&q=80'),
('VIP-002','Volvo','FH','https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=1000&q=80'),
('VIP-003','Mercedes-Benz','Actros','https://images.unsplash.com/photo-1586191582114-9d9c2d2b2d8f?auto=format&fit=crop&w=1000&q=80'),
('VIP-004','DAF','XF','https://images.unsplash.com/photo-1592838064575-70ed626d3a0e?auto=format&fit=crop&w=1000&q=80')
on conflict (id) do nothing;
insert into public.convoys (id,name,date,time,"from","to",server,distance) values
('convoy-1','VIP COMMUNITY CONVOY','18 SEP 2026','19:00 UTC','London','Dover','Simulation 1','250 KM'),
('convoy-2','RED ROAD RUN','25 SEP 2026','20:00 UTC','Manchester','Calais','Simulation 2','340 KM'),
('convoy-3','TOGETHER WE CAN','02 OCT 2026','19:30 UTC','Rotterdam','Brussels','Simulation 1','190 KM')
on conflict (id) do nothing;
insert into public.news (id,category,date,title,description) values
('news-1','VTC News','12 SEP 2026','Welcome to V.I.P LOGISTICS TRANSPORT','Our doors are open. Meet the team, explore our standards and start your journey with us.'),
('news-2','Convoys','08 SEP 2026','September Convoy Calendar','Three community events are now scheduled. Bring your best truck and join the formation.'),
('news-3','Recruitment','01 SEP 2026','Driver Recruitment Open','Applications are open for motivated drivers who want a friendly, rule-focused VTC experience.')
on conflict (id) do nothing;

create table if not exists public.applications (
  id uuid primary key,
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','REJECTED')),
  fields jsonb not null,
  message_id text not null unique,
  channel_id text not null,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists applications_status_idx on public.applications(status, created_at desc);
create index if not exists applications_channel_message_idx on public.applications(channel_id, message_id);
alter table public.applications enable row level security;

-- Driver delivery and monthly distance tracking.
create table if not exists public.delivery_records (
  id uuid primary key default gen_random_uuid(),
  driver_id text not null references public.drivers(id) on update cascade on delete cascade,
  delivery_date date not null default current_date,
  origin text not null default '',
  destination text not null default '',
  cargo text not null default '',
  distance_km integer not null check (distance_km > 0),
  created_at timestamptz not null default now()
);
create index if not exists delivery_records_driver_date_idx on public.delivery_records(driver_id, delivery_date desc);
create index if not exists delivery_records_date_idx on public.delivery_records(delivery_date desc);
alter table public.delivery_records enable row level security;


-- Automatically synchronized TruckersMP VTC members.
create table if not exists public.truckersmp_members (
  member_id text primary key,
  user_id text,
  username text not null,
  avatar_url text not null default '',
  role text not null default 'Member',
  joined_at timestamptz,
  active boolean not null default true,
  last_synced_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists truckersmp_members_active_idx on public.truckersmp_members(active, username);
create index if not exists truckersmp_members_user_idx on public.truckersmp_members(user_id);
alter table public.truckersmp_members enable row level security;
