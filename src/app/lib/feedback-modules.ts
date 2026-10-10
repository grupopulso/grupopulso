/*
 * Módulos que o usuário avalia (0 a 5) na janela de avaliação do
 * sistema - os mesmos do menu lateral. Cada pessoa só avalia os
 * que consegue ver (`permissions`: qualquer uma das chaves com
 * can_view); admin avalia todos.
 *
 * 0 = não uso / sem opinião (fica de fora das médias).
 */
export const FEEDBACK_MODULES = [
  {
    key: "dashboard",
    label: "Dashboard e Meu painel",
    permissions: ["dashboard"],
  },
  {
    key: "clients",
    label: "Clientes",
    permissions: ["clients"],
  },
  {
    key: "products",
    label: "Produtos e Serviços",
    permissions: ["products"],
  },
  {
    key: "contracts",
    label: "Contratos",
    permissions: ["contracts"],
  },
  {
    key: "prospecting",
    label: "Prospecção",
    permissions: ["prospecting"],
  },
  {
    key: "subscriptions",
    label: "Assinaturas",
    permissions: ["subscriptions"],
  },
  {
    key: "editions",
    label: "Edições e Publicidade",
    permissions: ["editions"],
  },
  {
    key: "routes",
    label: "Rotas e Entregas",
    permissions: ["routes"],
  },
  {
    key: "financial",
    label: "Financeiro",
    permissions: [
      "financial",
      "accounts_receivable",
      "accounts_payable",
      "receipts",
      "payments",
    ],
  },
  {
    key: "commissions",
    label: "Comissões",
    permissions: ["financial"],
  },
  {
    key: "goals",
    label: "Metas",
    permissions: ["financial"],
  },
  {
    key: "reports",
    label: "Relatórios",
    permissions: ["reports"],
  },
] as const;

export type FeedbackModule =
  (typeof FEEDBACK_MODULES)[number];

export function getFeedbackModulesForUser(
  role: string,
  permissions: {
    module: string;
    can_view: boolean;
  }[]
): { key: string; label: string }[] {
  return FEEDBACK_MODULES.filter(
    (item) =>
      role === "admin" ||
      permissions.some(
        (permission) =>
          permission.can_view &&
          (
            item.permissions as readonly string[]
          ).includes(permission.module)
      )
  ).map(({ key, label }) => ({
    key,
    label,
  }));
}
