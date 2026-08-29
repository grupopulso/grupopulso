# Migrações de banco pendentes

SQL que precisa ser rodado no Supabase (SQL Editor) para as features
já commitadas no código funcionarem 100%. Rode na ordem. Depois de
aplicar, marque com `[x]`.

---

## [x] J-a — Forma de pagamento prevista em lançamentos financeiros

Permite escolher a forma de pagamento (Dinheiro, Cheque, Boleto, PIX…)
já no cadastro de uma receita/despesa futura.

```sql
alter table public.financial_entries
  add column if not exists payment_method_id uuid
  references public.financial_payment_methods (id)
  on delete set null;

create index if not exists financial_entries_payment_method_id_idx
  on public.financial_entries (payment_method_id);
```

_Aplicado em 2026-08-29._

---

## [x] D — Meta anual por empresa

A tela de Metas agora tem um alternador **Mensal / Anual**. A meta anual
é gravada em `company_goals` com `month = 0` (1–12 continua sendo mensal).

```sql
alter table public.company_goals
  drop constraint if exists company_goals_month_check;

alter table public.company_goals
  add constraint company_goals_month_check
  check (month between 0 and 12);
```

_Aplicado em 2026-08-29._

---

## [x] E — Aporte de capital dos sócios

Nova tabela espelhando `partner_withdrawals`, para registrar entrada de
dinheiro que um sócio coloca na empresa (Agência Atthus / Pottencializa).

```sql
create table if not exists public.partner_contributions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  contribution_date date not null,
  notes text,
  financial_entry_id uuid references public.financial_entries (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists partner_contributions_company_id_idx
  on public.partner_contributions (company_id);

create index if not exists partner_contributions_user_id_idx
  on public.partner_contributions (user_id);

alter table public.partner_contributions enable row level security;

create policy "partner_contributions_select"
  on public.partner_contributions for select
  to authenticated using (true);

create policy "partner_contributions_insert"
  on public.partner_contributions for insert
  to authenticated with check (true);

create policy "partner_contributions_delete"
  on public.partner_contributions for delete
  to authenticated using (true);
```

_Aplicado em 2026-08-29._

---

## [x] C — Mapa da edição (nº de páginas) + posição "Coluna"

_Aplicado em 2026-08-29 (constraint + backfill + coluna page_count)._


### 1. Número de páginas da edição

```sql
alter table public.newspaper_editions
  add column if not exists page_count integer
  check (page_count is null or page_count > 0);
```

### 2. Posição "Coluna" (espaço dos colunistas)

Primeiro libere o novo código `columnist` no CHECK de `position_code`
(a lista antiga só tinha capa/contracapa/internos/sobrecapa):

```sql
alter table public.edition_ad_positions
  drop constraint if exists edition_ad_positions_code_check;

alter table public.edition_ad_positions
  add constraint edition_ad_positions_code_check
  check (position_code in (
    'cover', 'back_cover', 'inside_bw', 'inside_color', 'overcover', 'columnist'
  ));
```

> Se o nome da constraint for outro, rode para descobrir:
> `select conname, pg_get_constraintdef(oid) from pg_constraint
>  where conrelid = 'public.edition_ad_positions'::regclass and contype = 'c';`

Novas edições já nascem com a posição "Coluna" (geral + em cada caderno).
Para as edições **abertas** que já existem, rode o backfill:

```sql
-- posição geral (sem caderno) para cada edição aberta que ainda não tem
insert into public.edition_ad_positions
  (edition_id, section_id, position_code, name, capacity, manually_blocked, blocked_reason, active)
select e.id, null, 'columnist', 'Coluna', null, false, null, true
from public.newspaper_editions e
where e.status = 'open'
  and not exists (
    select 1 from public.edition_ad_positions p
    where p.edition_id = e.id
      and p.section_id is null
      and p.position_code = 'columnist'
  );

-- posição por caderno
insert into public.edition_ad_positions
  (edition_id, section_id, position_code, name, capacity, manually_blocked, blocked_reason, active)
select s.edition_id, s.id, 'columnist', 'Coluna', null, false, null, true
from public.edition_sections s
join public.newspaper_editions e on e.id = s.edition_id
where e.status = 'open'
  and not exists (
    select 1 from public.edition_ad_positions p
    where p.edition_id = s.edition_id
      and p.section_id = s.id
      and p.position_code = 'columnist'
  );
```

Sem a parte 1, o campo "nº de páginas" fica inerte (não grava). Sem a
parte 2, só as edições novas terão a posição "Coluna".
