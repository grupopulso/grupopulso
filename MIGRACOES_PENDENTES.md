# Migrações de banco pendentes

Nenhuma pendente no momento. Migrações concluídas ficam abaixo, marcadas,
como histórico.

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
