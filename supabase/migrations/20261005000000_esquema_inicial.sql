-- Carteira digital: esquema inicial
-- Dados de mercado (ativos, preços, índices, proventos e eventos vindos da B3) são globais,
-- lidos por qualquer usuário logado e gravados só pelo serviço de sincronização (service role).
-- Carteiras, lançamentos e proventos/eventos lançados à mão pertencem a cada usuário (RLS).

-- ---------------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------------
create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  criado_em timestamptz not null default now()
);

alter table public.perfis enable row level security;

create policy "perfil: dono lê" on public.perfis
  for select using (id = auth.uid());
create policy "perfil: dono altera" on public.perfis
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Ativos e dados de mercado (globais)
-- ---------------------------------------------------------------------------
create table public.ativos (
  ticker text primary key check (ticker ~ '^[A-Z0-9]{4}[0-9]{1,2}$'),
  nome text,
  classe text not null default 'acao' check (classe in ('acao', 'fii', 'etf', 'bdr')),
  setor text,
  cotacao numeric(14, 4),
  variacao_dia numeric(8, 4),
  cotacao_em timestamptz,
  -- dy, pl, pvp, roe, vacancia... (bolsai)
  indicadores jsonb not null default '{}'::jsonb,
  indicadores_em timestamptz,
  criado_em timestamptz not null default now()
);

create table public.precos_historicos (
  ticker text not null references public.ativos (ticker) on delete cascade,
  data date not null,
  fechamento numeric(14, 4) not null,
  primary key (ticker, data)
);

-- CDI: taxa diária em % (BCB SGS série 12). IBOV: pontos de fechamento.
create table public.indices (
  serie text not null check (serie in ('CDI', 'IBOV')),
  data date not null,
  valor numeric(16, 8) not null,
  primary key (serie, data)
);

create table public.sync_log (
  id bigint generated always as identity primary key,
  fonte text not null,
  ok boolean not null,
  mensagem text,
  em timestamptz not null default now()
);

alter table public.ativos enable row level security;
alter table public.precos_historicos enable row level security;
alter table public.indices enable row level security;
alter table public.sync_log enable row level security;

create policy "ativos: logados leem" on public.ativos
  for select to authenticated using (true);
create policy "precos: logados leem" on public.precos_historicos
  for select to authenticated using (true);
create policy "indices: logados leem" on public.indices
  for select to authenticated using (true);
create policy "sync_log: logados leem" on public.sync_log
  for select to authenticated using (true);

-- Usuário pode cadastrar um ticker novo (o sync completa nome, cotação e indicadores).
create or replace function public.registrar_ativo(p_ticker text, p_classe text)
returns public.ativos
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.ativos;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  insert into public.ativos (ticker, classe)
  values (upper(trim(p_ticker)), coalesce(p_classe, 'acao'))
  on conflict (ticker) do nothing;
  select * into v from public.ativos where ticker = upper(trim(p_ticker));
  return v;
end;
$$;

revoke all on function public.registrar_ativo(text, text) from public, anon;
grant execute on function public.registrar_ativo(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Carteiras e lançamentos (por usuário)
-- ---------------------------------------------------------------------------
create table public.carteiras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  criado_em timestamptz not null default now()
);

create index carteiras_user_idx on public.carteiras (user_id);

create table public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  carteira_id uuid not null references public.carteiras (id) on delete cascade,
  ticker text not null references public.ativos (ticker),
  tipo text not null check (tipo in ('compra', 'venda')),
  data date not null,
  quantidade numeric(18, 6) not null check (quantidade > 0),
  preco numeric(14, 4) not null check (preco >= 0),
  taxas numeric(14, 2) not null default 0 check (taxas >= 0),
  origem text not null default 'manual' check (origem in ('manual', 'b3')),
  -- identifica a linha da planilha da B3 para não importar duas vezes
  chave_importacao text,
  criado_em timestamptz not null default now(),
  unique (carteira_id, chave_importacao)
);

create index lancamentos_carteira_idx on public.lancamentos (carteira_id, data);

alter table public.carteiras enable row level security;
alter table public.lancamentos enable row level security;

create policy "carteiras: dono" on public.carteiras
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "lancamentos: dono" on public.lancamentos
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.carteiras c where c.id = carteira_id and c.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Proventos e eventos corporativos
-- user_id nulo = veio da B3 pelo sync (vale para todos); preenchido = lançado à mão pelo usuário.
-- ---------------------------------------------------------------------------
create table public.proventos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  ticker text not null references public.ativos (ticker) on delete cascade,
  tipo text not null check (tipo in ('dividendo', 'jcp', 'rendimento')),
  valor_por_cota numeric(16, 8) not null check (valor_por_cota > 0),
  data_com date not null,
  data_pagamento date,
  fonte text not null default 'manual' check (fonte in ('b3', 'manual')),
  -- 'b3' para os globais, o id do usuário para os manuais (permite upsert do sync sem duplicar)
  escopo text generated always as (coalesce(user_id::text, 'b3')) stored,
  criado_em timestamptz not null default now(),
  unique (escopo, ticker, tipo, data_com, valor_por_cota)
);

create index proventos_ticker_idx on public.proventos (ticker, data_com);

create table public.eventos_corporativos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  ticker text not null references public.ativos (ticker) on delete cascade,
  tipo text not null check (tipo in ('desdobramento', 'grupamento', 'bonificacao')),
  -- multiplica a quantidade: desdobramento 1:2 = 2; grupamento 10:1 = 0,1; bonificação de 10% = 1,1
  fator numeric(18, 10) not null check (fator > 0),
  -- custo atribuído por ação nova na bonificação (entra no preço médio)
  custo_unitario numeric(14, 6),
  data_com date not null,
  fonte text not null default 'manual' check (fonte in ('b3', 'manual')),
  escopo text generated always as (coalesce(user_id::text, 'b3')) stored,
  criado_em timestamptz not null default now(),
  unique (escopo, ticker, tipo, data_com)
);
create index eventos_ticker_idx on public.eventos_corporativos (ticker, data_com);

alter table public.proventos enable row level security;
alter table public.eventos_corporativos enable row level security;

create policy "proventos: ler globais e próprios" on public.proventos
  for select to authenticated using (user_id is null or user_id = auth.uid());
create policy "proventos: gravar próprios" on public.proventos
  for insert to authenticated with check (user_id = auth.uid() and fonte = 'manual');
create policy "proventos: alterar próprios" on public.proventos
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and fonte = 'manual');
create policy "proventos: excluir próprios" on public.proventos
  for delete to authenticated using (user_id = auth.uid());

create policy "eventos: ler globais e próprios" on public.eventos_corporativos
  for select to authenticated using (user_id is null or user_id = auth.uid());
create policy "eventos: gravar próprios" on public.eventos_corporativos
  for insert to authenticated with check (user_id = auth.uid() and fonte = 'manual');
create policy "eventos: alterar próprios" on public.eventos_corporativos
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and fonte = 'manual');
create policy "eventos: excluir próprios" on public.eventos_corporativos
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Novo usuário: cria perfil e a primeira carteira
-- ---------------------------------------------------------------------------
create or replace function public.ao_criar_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)));
  insert into public.carteiras (user_id, nome) values (new.id, 'Minha carteira');
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.ao_criar_usuario();

-- Tickers que aparecem em alguma carteira (o sync só busca esses)
create or replace view public.tickers_em_uso
with (security_invoker = true) as
  select distinct l.ticker, a.classe
  from public.lancamentos l
  join public.ativos a on a.ticker = l.ticker;
