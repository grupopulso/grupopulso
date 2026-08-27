# Auditoria de permissões (Grupo Pulso / O Estafeta) — continuação

> Handoff para continuar na aba **Code**. Isto é a continuação da revisão geral de
> permissões (prioridade #4 do projeto), que nasceu do fix de segurança em Rotas.
> Edições está **fora de escopo** (módulo concluído, só bug crítico).

## Doutrina (já validada e aplicada em Rotas, Sócios, Financeiro/[id] e Comissões)

Existem **dois eixos independentes** de proteção e uma página/Server Action pode ter
um sem o outro:

1. **Permissão de módulo** — `requireModulePermission(module, action)` de
   `@/app/lib/permissions.ts`. Admin sempre passa. Redireciona pra `/sem-permissao`.
2. **Escopo de empresa** — depois de buscar um registro específico (contrato,
   cliente, lançamento, sócio, etc.), chamar
   `await requireCompanyAccess(registro.company_id)` **antes** de permitir
   visualizar/editar/excluir. Admin sempre passa; outros usuários precisam ter
   `access.companyIds.includes(companyId)`.

Padrão de listagem (para páginas com filtro "Todas as empresas"):

```ts
if (selectedCompanyId) {
  query = query.eq("company_id", selectedCompanyId);
} else if (access.profile.role !== "admin") {
  if (access.companyIds.length > 0) {
    query = query.in("company_id", access.companyIds);
  } else {
    query = query.eq("company_id", "00000000-0000-0000-0000-000000000000");
  }
}
```

Regra de ouro do projeto: **nenhuma Server Action sensível pode depender só de
esconder botão no frontend** — o check tem que estar na Server Action.

IDs de empresa confirmados via SQL:
- O Estafeta: `ec5ed2f3-0052-4d6a-83ac-d60d768c7398`
- Agência Atthus: `a500a41f-9d6b-4cd6-af06-5920a0631dc1`
- Pottencializa: `9d08d74c-c5fe-48c9-b0c5-382cea273d99`

## ✅ Já corrigido e salvo no repositório (rodar `git diff` pra conferir)

1. **`financeiro/[id]/actions.ts`** — `registerFinancialTransaction` buscava o
   `financial_entries` por id e nunca validava se o usuário tinha acesso à empresa
   dele. Qualquer usuário com `financial.edit` conseguia dar baixa em lançamento de
   **qualquer empresa** só sabendo o id (achado mais crítico da auditoria). Corrigido
   com `await requireCompanyAccess(entry.company_id)` logo após buscar o lançamento.

2. **`comissoes/actions.ts`** — `payCommission` só chamava `requireEstafetaAccess()`
   (confirma vínculo com O Estafeta) mas **nenhuma permissão de módulo**. A página
   escondia o botão de pagar comissão pra role `"seller"`, só que esse role nem
   existe mais na constraint de `user_profiles.role` (admin/manager/finance/
   operations/viewer) — ou seja, o botão nunca era escondido de ninguém, e mesmo
   escondido a Server Action seguia aberta pra qualquer role. Corrigido adicionando
   `await requireModulePermission("financial", "edit")` na entrada da função.

3. **`comissoes/page.tsx`** — dois problemas:
   - A query de `contract_commissions` fazia join com `contracts` sem filtrar por
     empresa — vazava comissões de contratos da Agência Atthus/Pottencializa pra
     qualquer usuário vinculado só ao O Estafeta. Corrigido trocando o join pra
     `contract:contracts!inner(...)` incluindo `company_id` e adicionando
     `.eq("contract.company_id", access.estafetaCompany.id)`.
   - `canManageCommissions` usava o mesmo check morto (`role !== "seller"`).
     Trocado por `canAccessModule(access, "financial", "edit")`, consistente com a
     Server Action.

4. **Contratos** — mesmo achado crítico do financeiro: `requireModulePermission`
   presente, `requireCompanyAccess` ausente depois de buscar o contrato por id.
   Corrigido em:
   - `contratos/[id]/page.tsx`, `contratos/[id]/editar/page.tsx`,
     `contratos/[id]/recibo/page.tsx` — `await requireCompanyAccess(contract.company_id)`
     logo após o fetch do contrato (no recibo foi preciso adicionar `company_id` ao
     `select`, que só trazia `company:companies(...)`).
   - `contratos/[id]/actions.ts` — `deleteContract` não buscava o contrato; agora
     busca `id, company_id` antes de tudo e chama `requireCompanyAccess`.
     `renewContract` chama `requireCompanyAccess(oldContract.company_id)` após o fetch.
   - `contratos/[id]/editar/actions.ts` — `updateContract` valida a empresa atual do
     contrato e, se `input.companyId` for diferente (movendo de empresa), valida
     também a empresa de destino.
   - `contratos/novo/actions.ts` — `createContract` valida `input.companyId` do
     formulário com `requireCompanyAccess` (mesmo padrão de `rotas/nova/actions.ts`).
     Cobre também `renewContract`, que delega a criação a `createContract`.
   - `contratos/novo/page.tsx` — só renderiza o form (`ContractForm`), sem dados de
     contrato específico; permissão de módulo é suficiente. Obs.: o seletor de
     empresa do `ContractForm` ainda lista todas as empresas para não-admin (só
     cosmético — a Server Action agora bloqueia).

5. **Clientes** — `clientes/page.tsx` já escopava; as telas de detalhe/edição não
   conferiam empresa. Como cliente é N:N com empresa (`client_companies`, sem
   `company_id` direto), foi criado o helper `requireAnyCompanyAccess(companyIds[])`
   em `@/app/lib/permissions.ts` (admin passa; demais precisam de vínculo com pelo
   menos uma). Aplicado em:
   - `clientes/[id]/page.tsx` e `clientes/[id]/editar/page.tsx` — busca os
     `client_companies` do cliente e chama `requireAnyCompanyAccess` após o fetch
     (na page de detalhe foi preciso adicionar `company_id` ao `select`).
   - `clientes/[id]/editar/actions.ts` — `updateClient` valida acesso pelas empresas
     atuais do cliente e, para não-admin, recusa vincular a uma empresa **nova**
     fora do escopo (mantendo as que o cliente já tinha).
   - `clientes/novo/page.tsx` / `ClientForm` — **convertido para Server Action**. O
     `ClientForm` (`src/app/components/client-form.tsx`) fazia os `insert` direto pelo
     Supabase client no browser. Agora existe `clientes/novo/actions.ts` →
     `createClientRecord`, que chama `requireModulePermission("clients","create")`,
     valida que todo `companyId` recebido do form está em `access.companyIds`
     (não-admin), confere que as empresas existem/estão ativas, e faz rollback do
     cliente se o endereço ou os vínculos falharem. A página passou a carregar a
     lista de empresas já filtrada pelo escopo do usuário e a repassa como prop
     (não é mais buscada no browser). RLS continua valendo como 2ª camada.

   Resíduo (não é bug de gate): `clientes/[id]/page.tsx` lista `contracts` e
   `financial_entries` do cliente por `client_id` sem filtrar por empresa — se um
   cliente é compartilhado entre a empresa A (do usuário) e a B, contratos da B
   aparecem na ficha. A trava de acesso à página está correta; o vazamento é só
   nas sublistas.

6. **Produtos** — `produtos/page.tsx` já escopava. Não existe `produtos/[id]/`: a
   UI só tem listagem + cadastro, não há edição de produto. O `ProductForm`
   (`src/app/components/product-form.tsx`) fazia `supabase.from("products").insert()`
   direto no browser, sem Server Action nem escopo. **Convertido para Server
   Action** igual a Clientes: `produtos/novo/actions.ts` → `createProductRecord`
   chama `requireModulePermission("products","create")` + `requireCompanyAccess`
   (produto tem `company_id` direto, então check simples), valida empresa
   ativa/valor/comissão, e faz auditoria. `produtos/novo/page.tsx` carrega as
   empresas já filtradas pelo escopo e passa como prop; `ProductForm` chama a action
   via `useTransition`.

7. **Empresas** — auditado, **nenhuma mudança necessária**. Todas as três páginas
   (`empresas/page.tsx`, `empresas/nova/page.tsx`, `empresas/[id]/page.tsx`) e as
   duas Server Actions (`createCompany` em `empresas/nova/actions.ts`,
   `updateCompany` em `empresas/[id]/actions.ts`) já chamam `requireAdmin()` na
   entrada. Não há action de exclusão de empresa nem mutação client-side de
   `companies` em nenhum lugar do app.

8. **Financeiro (listagens e configurações — fora do `[id]` já corrigido)** — feito.

   Listagens que só filtravam por `selectedCompanyId` e vazavam tudo para não-admin
   em "Todas as empresas":
   - `financeiro/receber/page.tsx` e `financeiro/pagar/page.tsx` — adicionado o
     `else if (role !== "admin")` do padrão da Doutrina na query de
     `financial_entries`.
   - `financeiro/recebimentos/page.tsx` e `financeiro/pagamentos/page.tsx` —
     filtram `financial_transactions` em memória pelo `financial_entry.company_id`;
     adicionado o mesmo escopo in-memory para não-admin.
   - `financeiro/fluxo/page.tsx` — **não tinha nenhum check** (nem módulo nem
     empresa). Adicionado `requireModulePermission("financial","view")` e escopo
     in-memory nos três filtros (contas, transações, lançamentos), tratando conta
     sem `company_id` como compartilhada.

   Configurações financeiras — **nenhuma tinha check de permissão**:
   - `financeiro/configuracoes/page.tsx` (hub), `.../categorias`, `.../centros-custo`,
     `.../contas`, `.../fornecedores`, `.../fornecedores/novo` — adicionado
     `requireModulePermission("financial","edit")` (são telas de gestão de config
     estrutural; viewer não deve configurar conta bancária).
   - `.../centros-custo` e `.../contas` — além do gate, passaram a filtrar a lista e
     o dropdown de empresas pelo escopo do usuário (registro sem `company_id` =
     compartilhado).

   **Managers convertidos para Server Action.** Novo `financeiro/configuracoes/actions.ts`
   com `createFinancialCategory`, `createCostCenter`, `createFinancialAccount`,
   `createSupplier` — todos gated com `requireModulePermission("financial","edit")`;
   `createCostCenter` e `createFinancialAccount` também chamam `requireCompanyAccess`
   quando um `companyId` é informado, e recusam criar registro compartilhado
   (`company_id` null) para não-admin. Os 4 componentes (`category-manager`,
   `cost-center-manager`, `financial-account-manager`, `supplier-form`) não usam mais
   `@/app/lib/supabase/client` — chamam as actions via `useTransition` e mostram erro.
   As pages `centros-custo` e `contas` passam `isAdmin` para o manager esconder a
   opção "compartilhada" de não-admin.

9. **Schema `profiles` vs `user_profiles`** — resolvido.

   Diagnóstico via SQL: `profiles` é uma **tabela órfã** com só 1 linha (o admin).
   `user_profiles` (`id, name, role, active, created_at, updated_at`) tem os 4
   usuários reais e é a fonte de verdade (é ela que tem `user_permissions` e
   `user_companies`). Toda tela que resolvia nome de vendedor/beneficiário via
   `.from("profiles")` caía no fallback ("Usuário"/"Beneficiário") para os não-admin.

   - **SQL rodado** (pelo usuário): abriu a policy de SELECT de `user_profiles` para
     qualquer autenticado (`for select to authenticated using (true)`) — antes só
     dava pra ler a própria linha, o que impediria os dropdowns de vendedor e a
     resolução de nome de beneficiário. `user_profiles` só tem nome/cargo, sem dado
     sensível; `user_permissions`/`user_companies` mantêm RLS própria.
   - **Código migrado** (~12 arquivos): `.from("profiles")` → `.from("user_profiles")`,
     `full_name` → `name`, `email` removido do select (não existe em `user_profiles`;
     onde era fallback de exibição virou só `x.name ?? "…"`). Arquivos:
     `comissoes/page.tsx` + `actions.ts`, `financeiro/[id]/actions.ts`,
     `contratos/[id]/page.tsx`, `components/contract-form.tsx`,
     `configuracoes/vendedores/` (page + actions + seller-management + seller-form +
     override-management), `edicoes/[id]/page.tsx`,
     `edicoes/[id]/vendas/{nova,[saleId],[saleId]/editar}/` (pages + sale-form +
     edit-sale-form).
   - A tabela `profiles` ficou órfã — pode ser dropada num segundo momento, sem
     pressa. `grep -rn '"profiles"' src/` volta vazio.

## Como testar cada fix

Depois de cada arquivo corrigido: logar com um usuário não-admin vinculado a só uma
empresa (ex.: só Pottencializa) e tentar acessar/editar um registro de outra empresa
(ex.: um contrato do O Estafeta) trocando o id na URL — deve cair em
`/sem-permissao`, não deve conseguir ver os dados.
