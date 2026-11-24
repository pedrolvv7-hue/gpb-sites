-- School Sports AI · esquema relacional com Row Level Security.
-- Estado: pronto para aplicar. A interface atual salva partidas localmente; a sincronização com
-- estas tabelas é a próxima etapa (ver PROGRESS.md). Vídeos NÃO ficam no banco.

create extension if not exists pgcrypto;

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  retention_days int not null default 30 check (retention_days between 1 and 3650),
  recording_policy text not null default 'desligada' check (recording_policy in ('desligada','com_autorizacao')),
  created_at timestamptz not null default now()
);

create type public.member_role as enum ('admin','professor','auxiliar');
create table public.school_members (
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'professor',
  created_at timestamptz not null default now(),
  primary key (school_id, user_id)
);
create index on public.school_members(user_id);

-- Funções auxiliares (security definer evita recursão nas políticas)
create or replace function public.is_member(s uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from school_members where school_id = s and user_id = auth.uid()) $$;
create or replace function public.is_school_admin(s uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from school_members where school_id = s and user_id = auth.uid() and role = 'admin') $$;

create table public.rules_profiles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade, -- null = perfil padrão do sistema
  sport text not null check (sport in ('futsal','basketball','volleyball')),
  name text not null,
  version int not null default 1,
  config jsonb not null,
  created_at timestamptz not null default now(),
  unique (school_id, sport, name, version)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  sport text not null check (sport in ('futsal','basketball','volleyball')),
  name text not null check (char_length(name) between 2 and 80),
  kind text not null check (kind in ('amistoso','campeonato','treinamento','aula','avaliacao')),
  class_name text,
  match_date date not null,
  state text not null default 'configurando' check (state in ('configurando','ao_vivo','pausada','encerrada')),
  scoring_mode text not null default 'assistido' check (scoring_mode in ('assistido','automatico_experimental')),
  rules_profile_id uuid references public.rules_profiles(id),
  rules_snapshot jsonb not null,
  period int not null default 1,
  clock_ms bigint not null default 0,
  coverage jsonb not null default '{}'::jsonb,
  notes text,
  share_code text unique,               -- código de espectador (privado por padrão: null)
  share_expires_at timestamptz,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index on public.matches(school_id, created_at desc);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  side char(1) not null check (side in ('A','B')),
  name text not null,
  primary_color text not null check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  secondary_color text, keeper_color text,
  unique (match_id, side)
);

-- Jogadores opcionais: sem nome completo, sem biometria.
create table public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  shirt_number text check (shirt_number ~ '^[0-9]{1,3}$'),
  nickname text check (char_length(nickname) <= 20),
  starter boolean not null default false,
  unique (team_id, shirt_number)
);

create table public.cameras (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  device_label text not null,
  role text not null,
  kind text not null check (kind in ('local','arquivo','remota')),
  connected_at timestamptz, disconnected_at timestamptz
);

create table public.calibrations (
  id uuid primary key default gen_random_uuid(),
  camera_id uuid not null references public.cameras(id) on delete cascade,
  image_points jsonb not null, court_points jsonb not null, homography double precision[] check (array_length(homography,1) = 9),
  reprojection_error_m double precision, regions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  type text not null,
  t_ms bigint not null check (t_ms >= 0),
  period int not null,
  team char(1) check (team in ('A','B')),
  player_ref text,                       -- identificador temporário (A01) ou número de camisa
  points int check (points between 0 and 3),
  scoring boolean not null default false,
  confidence real not null check (confidence between 0 and 1),
  status text not null check (status in ('detectado','estimado','aguardando','confirmado_auto','confirmado_manual','rejeitado','corrigido','indeterminado')),
  origin text not null check (origin in ('ia','manual')), -- demonstração nunca é gravada no banco
  note text, clip_path text,
  created_at timestamptz not null default now()
);
create index on public.events(match_id, t_ms);

create table public.evidences (
  id bigserial primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  camera_id uuid references public.cameras(id) on delete set null,
  t_ms bigint not null, kind text not null, detail text not null, confidence real not null
);

-- Auditoria: correções nunca apagam o histórico.
create table public.corrections (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  by_user uuid references auth.users(id),
  action text not null check (action in ('confirmar','rejeitar','corrigir','criar','invalidar','observacao')),
  before jsonb, after jsonb,
  at timestamptz not null default now()
);

-- Posições agregadas (1 Hz). Sem quadros de vídeo.
create table public.position_samples (
  match_id uuid not null references public.matches(id) on delete cascade,
  t_ms bigint not null, track_ref text not null, team char(1) not null check (team in ('A','B','U')),
  x real not null, y real not null, estimated boolean not null default false,
  primary key (match_id, track_ref, t_ms)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  summary jsonb not null, created_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  sport text not null, name text not null, goal text not null, config jsonb not null,
  created_at timestamptz not null default now()
);

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  activity_name text not null, sport text not null, counts jsonb not null,
  started_at timestamptz not null, ended_at timestamptz
);

create table public.audit_log (
  id bigserial primary key,
  school_id uuid references public.schools(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null, target text, at timestamptz not null default now()
);

-- ---------------- RLS ----------------
alter table public.schools enable row level security;
alter table public.school_members enable row level security;
alter table public.rules_profiles enable row level security;
alter table public.matches enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.cameras enable row level security;
alter table public.calibrations enable row level security;
alter table public.events enable row level security;
alter table public.evidences enable row level security;
alter table public.corrections enable row level security;
alter table public.position_samples enable row level security;
alter table public.reports enable row level security;
alter table public.activities enable row level security;
alter table public.training_sessions enable row level security;
alter table public.audit_log enable row level security;

create policy "membros veem a escola" on public.schools for select using (is_member(id));
create policy "admin altera a escola" on public.schools for update using (is_school_admin(id));
create policy "membros veem membros" on public.school_members for select using (is_member(school_id));
create policy "admin gerencia membros" on public.school_members for all using (is_school_admin(school_id)) with check (is_school_admin(school_id));
create policy "perfis padrão ou da escola" on public.rules_profiles for select using (school_id is null or is_member(school_id));
create policy "membros criam perfis" on public.rules_profiles for insert with check (school_id is not null and is_member(school_id));

create policy "partidas da escola" on public.matches for all using (is_member(school_id)) with check (is_member(school_id) and created_by = auth.uid());

-- Tabelas filhas herdam o acesso pela partida
create or replace function public.can_match(m uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from matches where id = m and is_member(school_id)) $$;
create policy "via partida" on public.teams for all using (can_match(match_id)) with check (can_match(match_id));
create policy "via partida" on public.cameras for all using (can_match(match_id)) with check (can_match(match_id));
create policy "via partida" on public.events for all using (can_match(match_id)) with check (can_match(match_id));
create policy "via partida" on public.corrections for select using (can_match(match_id));
create policy "inserir correção" on public.corrections for insert with check (can_match(match_id) and by_user = auth.uid());
create policy "via partida" on public.position_samples for all using (can_match(match_id)) with check (can_match(match_id));
create policy "via partida" on public.reports for all using (can_match(match_id)) with check (can_match(match_id));
create policy "via equipe" on public.players for all using (exists (select 1 from teams t where t.id = team_id and can_match(t.match_id)));
create policy "via câmera" on public.calibrations for all using (exists (select 1 from cameras c where c.id = camera_id and can_match(c.match_id)));
create policy "via evento" on public.evidences for all using (exists (select 1 from events e where e.id = event_id and can_match(e.match_id)));
create policy "atividades da escola" on public.activities for all using (is_member(school_id)) with check (is_member(school_id));
create policy "treinos da escola" on public.training_sessions for all using (is_member(school_id)) with check (is_member(school_id));
create policy "admin lê auditoria" on public.audit_log for select using (is_school_admin(school_id));
-- Correções não podem ser alteradas nem apagadas por ninguém (sem políticas de update/delete).

-- Placar público somente leitura para espectadores com código válido (sem dados de alunos).
create or replace function public.public_scoreboard(code text) returns table (name text, sport text, team_a text, team_b text, score_a int, score_b int, state text)
language sql stable security definer set search_path = public as $$
  select m.name, m.sport,
    (select name from teams where match_id = m.id and side = 'A'), (select name from teams where match_id = m.id and side = 'B'),
    coalesce((select sum(points) from events e where e.match_id = m.id and e.scoring and e.team = 'A' and e.status in ('confirmado_auto','confirmado_manual','corrigido')),0)::int,
    coalesce((select sum(points) from events e where e.match_id = m.id and e.scoring and e.team = 'B' and e.status in ('confirmado_auto','confirmado_manual','corrigido')),0)::int,
    m.state
  from matches m where m.share_code = code and (m.share_expires_at is null or m.share_expires_at > now())
$$;
grant execute on function public.public_scoreboard(text) to anon, authenticated;

-- Retenção: apagar partidas encerradas além do prazo da escola (agendar com pg_cron).
create or replace function public.apply_retention() returns void language sql security definer set search_path = public as $$
  delete from matches m using schools s where m.school_id = s.id and m.state = 'encerrada' and m.ended_at < now() - make_interval(days => s.retention_days)
$$;
