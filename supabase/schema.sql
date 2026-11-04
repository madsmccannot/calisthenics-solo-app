-- Esquema da base de dados (Supabase / Postgres) para a calisthenics-solo-app.
-- Correr no SQL Editor do Supabase (dashboard) uma vez.
-- Cada tabela tem Row-Level Security: cada utilizador só acede aos SEUS dados
-- (exceto o feed, que é legível por todos os autenticados).

-- ─────────────────────────────── Perfil ───────────────────────────────
create table if not exists profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  weight       numeric,
  height       numeric,
  class        text default 'Iniciante',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ───────────────────────── Progressão (gameState) ─────────────────────
create table if not exists progress (
  user_id      uuid primary key references auth.users on delete cascade,
  xp           int default 0,
  coins        int default 0,
  season       int default 1,
  avatar       jsonb default '{}'::jsonb,
  owned_items  jsonb default '[]'::jsonb,
  medals       jsonb default '{}'::jsonb,
  stats        jsonb default '{}'::jsonb,
  missions     jsonb,
  updated_at   timestamptz default now()
);

-- ─────────────────────────────── Streak ───────────────────────────────
create table if not exists streaks (
  user_id             uuid primary key references auth.users on delete cascade,
  current             int default 0,
  best                int default 0,
  last_completed_date text
);

-- ────────────────────────────── Peso ──────────────────────────────────
create table if not exists weight_log (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users on delete cascade,
  date       text,
  weight     numeric,
  created_at timestamptz default now()
);

-- ────────────────────────── Plano (season atual) ──────────────────────
create table if not exists plans (
  user_id    uuid primary key references auth.users on delete cascade,
  season     int default 1,
  plan_class text,
  days       jsonb,
  updated_at timestamptz default now()
);

-- ─────────────────────────────── Feed ─────────────────────────────────
create table if not exists feed_events (
  id         bigint generated always as identity primary key,
  user_id    uuid references profiles(id) on delete cascade,
  name       text, -- nome do autor guardado no evento (evita ler perfis de outros)
  ts         bigint,
  emoji      text,
  title      text,
  subtitle   text,
  created_at timestamptz default now()
);
create index if not exists idx_feed_ts on feed_events (ts desc);

-- ────────────────── Cria as linhas do utilizador no signup ─────────────
-- IMPORTANTE: `set search_path = public` + nomes qualificados (public.*), senão
-- a função security definer não encontra as tabelas e o signup rebenta com 500.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.progress (user_id) values (new.id) on conflict do nothing;
  insert into public.streaks (user_id) values (new.id) on conflict do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────── Nome de utilizador único + resolver nome->email no login ────
-- Nome de utilizador único (case-insensitive).
create unique index if not exists profiles_display_name_unique
  on profiles (lower(display_name));

-- SEGURANÇA: o login por nome de utilizador NÃO é resolvido em SQL exposto ao
-- cliente. A função antiga `email_for_username` era security definer e estava
-- concedida a `anon` -> qualquer pessoa, sem autenticação, obtinha o email de
-- uma conta a partir do nome (fuga de PII + enumeração). Foi removida.
-- O login por nome passa agora por uma Edge Function (`login-username`) que
-- resolve o email no servidor (service role) e devolve apenas uma sessão quando
-- a password está correta — o email nunca chega ao cliente. Ver docs/SECURITY.md.
drop function if exists public.email_for_username(text);

-- ─────────────────────── Row-Level Security ───────────────────────────
alter table profiles    enable row level security;
alter table progress    enable row level security;
alter table streaks     enable row level security;
alter table weight_log  enable row level security;
alter table plans       enable row level security;
alter table feed_events enable row level security;

-- dados privados: dono acede só aos seus
create policy own_profile   on profiles    for all using (auth.uid() = id)      with check (auth.uid() = id);
create policy own_progress  on progress     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_streaks   on streaks      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_weight    on weight_log   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_plans     on plans        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- feed: qualquer autenticado LÊ; só escreve os seus próprios eventos
create policy feed_read   on feed_events for select to authenticated using (true);
create policy feed_insert on feed_events for insert to authenticated with check (auth.uid() = user_id);

-- ──────────────────────── Migração (aditiva, re-executável) ────────────────
-- Necessária para o sync não-destrutivo do peso e para persistir o ledger de
-- idempotência de treinos. Segura de correr em dados existentes.
--   1) upsert do weight_log por (user_id, date) exige esta constraint única;
--   2) rewarded_workouts guarda que treinos (season:dia) já deram recompensa.
create unique index if not exists weight_log_user_date_unique on weight_log (user_id, date);
alter table progress add column if not exists rewarded_workouts jsonb default '{}'::jsonb;
-- Phase 4: per-exercise earned progression ({ exerciseId: { offset, ... } }).
alter table progress add column if not exists progression jsonb default '{}'::jsonb;
-- Personalization: profile preferences that drive plan generation
-- ({ daysPerWeek, sessionMinutes, exclude }). Kept as one jsonb so new prefs
-- don't each need a column + migration.
alter table profiles add column if not exists prefs jsonb default '{}'::jsonb;
