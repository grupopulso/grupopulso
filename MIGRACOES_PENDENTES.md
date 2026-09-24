# Migrações de banco pendentes

---

## [ ] Tabelas `prospecting_lists` / `prospecting_leads` (Prospecção)

Tela nova "Prospecção" no menu lateral: dentro de cada empresa, o
usuário cria listas (ex.: "Guia de Serviços 2026") e dentro de cada
lista cadastra os clientes a prospectar (nome, vendedor responsável,
valor, tamanho do anúncio, situação e observação de cobrança) —
substitui as planilhas usadas hoje pra não haver vendedores
oferecendo pro mesmo cliente.

```sql
create table if not exists public.prospecting_lists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prospecting_leads (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.prospecting_lists(id) on delete cascade,
  client_name text not null,
  seller_user_id uuid references public.user_profiles(id),
  value numeric(12,2),
  size text,
  status text not null default 'none' check (status in ('none', 'contacted', 'closed', 'declined')),
  billing_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prospecting_lists_company_id_idx
  on public.prospecting_lists (company_id);

create index if not exists prospecting_leads_list_id_idx
  on public.prospecting_leads (list_id);

alter table public.prospecting_lists enable row level security;
alter table public.prospecting_leads enable row level security;
```

Sem RLS policy própria de propósito — igual ao resto do financeiro,
o acesso é controlado na aplicação (`requireModulePermission`) e as
leituras/escritas passam pelo cliente admin (service role).

Status: `none` (sem contato, aparece em branco), `contacted`
(amarelo), `closed` (fechou o anúncio, verde), `declined` (não quer
anunciar, vermelho).

---

## [ ] Colunas `deactivated_at` / `reassigned_at` em `user_profiles` (usuário inativo → reatribuição)

Quando um usuário é desativado, os contratos/vendas dele passam a ser
do "vendedor da empresa" (um usuário por empresa: Atthus, Pottencializa,
O Estafeta) — mas só a partir do mês seguinte à saída. Essas colunas
guardam quando ele saiu e se já foi reatribuído, pra tela de "Usuários
inativos" (dentro de Auditoria) e pro job de reatribuição saberem o que
fazer.

```sql
alter table public.user_profiles
  add column if not exists deactivated_at timestamptz;

alter table public.user_profiles
  add column if not exists reassigned_at timestamptz;
```

Sem isso, a tela de "Usuários inativos" e a reatribuição automática dão
erro (colunas não existem).

---

## [x] Coluna `invoice_mode` em `contracts` (nota fiscal única ou por parcela) — já aplicada em 14/09

Contrato agora escolhe entre nota fiscal única (uma para o contrato
inteiro) ou uma nota fiscal por parcela. Sem essa coluna, a tela de
contrato (novo, editar e detalhe) dá erro ao gravar/ler esse campo.

```sql
alter table public.contracts
  add column if not exists invoice_mode text not null default 'single'
  check (invoice_mode in ('single', 'per_installment'));
```

Contratos já existentes ficam com `single`, que é o comportamento atual
(uma NF só, usando a 1ª parcela como referência).

---

## [ ] Meta de vendedor passa a ser só mensal (não mais por empresa)

O vendedor agora tem UMA meta por mês, valendo pra soma das vendas nas
3 empresas (antes era uma meta separada por empresa). A tabela está
vazia ainda (nenhuma meta foi cadastrada), então dá pra simplificar
sem perder nada:

```sql
alter table public.seller_goals
  drop constraint if exists seller_goals_user_id_company_id_year_month_key;

alter table public.seller_goals
  drop column if exists company_id;

alter table public.seller_goals
  add constraint seller_goals_user_id_year_month_key
  unique (user_id, year, month);
```

Sem isso, a tela de metas dos vendedores dá erro (o código já não usa
mais `company_id`).

---

## [x] Posições de capa/contracapa/sobrecapa sem limite nas edições ABERTAS

As edições novas já nascem com todas as posições ilimitadas (a "esgotada"
agora é manual, pelo botão Esgotar). Para as edições **abertas** que já
existem, libere o limite das posições que vinham com capacidade 1:

```sql
update public.edition_ad_positions p
set capacity = null,
    updated_at = now()
from public.newspaper_editions e
where p.edition_id = e.id
  and e.status = 'open'
  and p.position_code in ('cover', 'back_cover', 'overcover')
  and p.capacity is not null;
```

Sem isso, essas posições nas edições abertas continuam com limite 1 e
aparecem como "Esgotada" automaticamente após a 1ª venda.

---

## [x] Tabela `seller_goals` (metas mensais por vendedor)

Necessária para a funcionalidade de metas por vendedor (cadastro em
Configurações → Vendedores → Metas, exibição em Meu Painel e relatório
`/relatorios/vendedores`). Sem rodar isso, essas telas dão erro.

```sql
create table if not exists public.seller_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  target_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, company_id, year, month)
);

alter table public.seller_goals enable row level security;

-- Vendedor vê a própria meta; admin vê todas.
create policy "seller_goals_select" on public.seller_goals
  for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Só admin cadastra/edita/remove metas de vendedor.
create policy "seller_goals_admin_insert" on public.seller_goals
  for insert
  with check (
    exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "seller_goals_admin_update" on public.seller_goals
  for update
  using (
    exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "seller_goals_admin_delete" on public.seller_goals
  for delete
  using (
    exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
```
