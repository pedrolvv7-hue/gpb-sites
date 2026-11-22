-- RestauProfit Pro: banco usado pelo login.
-- Cole no Supabase em SQL Editor > New query > Run.
-- Cada usuário tem uma linha com todos os dados do seu restaurante.
-- RLS garante que ninguém leia ou altere os dados de outra conta.

create table if not exists public.restaurant_data (
  user_id uuid primary key references auth.users on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.restaurant_data enable row level security;

drop policy if exists "dono le" on public.restaurant_data;
drop policy if exists "dono cria" on public.restaurant_data;
drop policy if exists "dono altera" on public.restaurant_data;
drop policy if exists "dono apaga" on public.restaurant_data;

create policy "dono le" on public.restaurant_data for select using (auth.uid() = user_id);
create policy "dono cria" on public.restaurant_data for insert with check (auth.uid() = user_id);
create policy "dono altera" on public.restaurant_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono apaga" on public.restaurant_data for delete using (auth.uid() = user_id);
