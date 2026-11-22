-- RestauProfit Pro: esquema para migração ao Supabase (PostgreSQL).
-- NÃO está ativo na versão atual (que guarda dados no navegador).
-- Cada tabela pertence a uma organização; RLS garante que um usuário só
-- veja os dados das organizações das quais é membro.

create table organizations (id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz default now());
create table memberships (
  org_id uuid references organizations on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null check (role in ('owner','manager','staff')),
  primary key (org_id, user_id)
);
create table units (id uuid primary key default gen_random_uuid(), org_id uuid not null references organizations on delete cascade, name text not null, code text not null, city text, seats int, unique (org_id, code));

-- Tabela genérica de registros por entidade (espelha src/data/schema.ts).
-- Valores monetários ficam em numeric dentro do JSON e são validados no backend.
create table records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  unit_code text,
  entity text not null,
  data jsonb not null,
  import_id uuid,
  created_at timestamptz default now(),
  created_by uuid references auth.users
);
create index on records (org_id, entity);
create table imports (id uuid primary key, org_id uuid not null references organizations on delete cascade, file_name text, entity text, kind text, inserted int, duplicates int, errors int, error_rows jsonb, undone boolean default false, at timestamptz default now());
create table audit_log (id bigserial primary key, org_id uuid not null references organizations on delete cascade, user_id uuid, action text, entity text, detail text, at timestamptz default now());

alter table organizations enable row level security;
alter table memberships enable row level security;
alter table units enable row level security;
alter table records enable row level security;
alter table imports enable row level security;
alter table audit_log enable row level security;

create function is_member(o uuid) returns boolean language sql security definer stable as
$$ select exists (select 1 from memberships where org_id = o and user_id = auth.uid()) $$;
create function is_manager(o uuid) returns boolean language sql security definer stable as
$$ select exists (select 1 from memberships where org_id = o and user_id = auth.uid() and role in ('owner','manager')) $$;

create policy org_read on organizations for select using (is_member(id));
create policy mem_read on memberships for select using (is_member(org_id));
create policy units_rw on units for all using (is_member(org_id)) with check (is_manager(org_id));
create policy rec_read on records for select using (is_member(org_id) and (entity not in ('employees','payroll','customers') or is_manager(org_id)));
create policy rec_write on records for insert with check (is_member(org_id));
create policy rec_update on records for update using (is_manager(org_id));
create policy rec_delete on records for delete using (is_manager(org_id));
create policy imp_rw on imports for all using (is_member(org_id)) with check (is_member(org_id));
create policy audit_read on audit_log for select using (is_manager(org_id));
create policy audit_insert on audit_log for insert with check (is_member(org_id));
