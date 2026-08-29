# Migrações de banco pendentes

SQL que precisa ser rodado no Supabase (SQL Editor) para as features
já commitadas no código funcionarem 100%. Rode na ordem. Depois de
aplicar, marque com `[x]`.

---

## [ ] J-a — Forma de pagamento prevista em lançamentos financeiros

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

O formulário só envia `payment_method_id` quando o usuário escolhe uma
forma, então o cadastro continua funcionando mesmo antes desta migração —
mas o campo fica inerte até ela ser aplicada.

---

## [ ] D — Meta anual por empresa

A tela de Metas agora tem um alternador **Mensal / Anual**. A meta anual
é gravada em `company_goals` com `month = 0` (1–12 continua sendo mensal).
É preciso liberar o valor 0 na coluna `month`:

```sql
alter table public.company_goals
  drop constraint if exists company_goals_month_check;

alter table public.company_goals
  add constraint company_goals_month_check
  check (month between 0 and 12);
```

Sem esta migração, salvar uma meta anual retorna erro de check constraint
(as metas mensais seguem funcionando normalmente).

---

## [ ] E — Aporte de capital dos sócios

Nova tabela espelhando `partner_withdrawals`, para registrar entrada de
dinheiro que um sócio coloca na empresa (Agência Atthus / Pottencializa).
A tela de Sócios já tem o formulário e a listagem — só falta a tabela.

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

-- Mesma política usada em partner_withdrawals: leitura/escrita para
-- usuários autenticados (o controle fino é feito nas Server Actions,
-- que exigem financial + acesso à empresa). Ajuste se a sua policy
-- de partner_withdrawals for diferente.
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

O lançamento financeiro gerado pelo aporte é do tipo `income` (quitado),
mas a tela de Sócios o exclui do "Recebido" — aporte não entra na divisão
de lucro. Sem a tabela, o formulário de aporte retorna erro ao salvar
(o resto da tela continua funcionando).
