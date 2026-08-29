import Link from "next/link";
import {
  Building2,
  CreditCard,
  Landmark,
  Tags,
  Truck,
} from "lucide-react";

import {
  requireModulePermission,
} from "@/app/lib/permissions";

const items = [
  {
    title: "Fornecedores",
    description:
      "Cadastre empresas e pessoas relacionadas às contas a pagar.",
    href: "/financeiro/configuracoes/fornecedores",
    icon: Truck,
  },
  {
    title: "Categorias financeiras",
    description:
      "Organize receitas e despesas por categoria.",
    href: "/financeiro/configuracoes/categorias",
    icon: Tags,
  },
  {
    title: "Centros de custo",
    description:
      "Separe despesas e receitas por área ou operação.",
    href: "/financeiro/configuracoes/centros-custo",
    icon: Building2,
  },
  {
    title: "Contas e caixas",
    description:
      "Gerencie contas bancárias, caixas e carteiras.",
    href: "/financeiro/configuracoes/contas",
    icon: Landmark,
  },
  {
    title: "Formas de pagamento",
    description:
      "Dinheiro, cheque, boleto, PIX. Somente administradores podem cadastrar.",
    href: "/configuracoes/formas-pagamento",
    icon: CreditCard,
  },
];

export default async function ConfiguracoesFinanceirasPage() {
  await requireModulePermission(
    "financial",
    "edit"
  );

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-6xl">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Cadastros Financeiros
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Configure as informações utilizadas pelo módulo
            financeiro do Grupo Pulso.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {items.map(({ title, description, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-[#15704f]/30 hover:shadow-sm"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15704f]/10">
                <Icon className="h-5 w-5 text-[#15704f]" />
              </div>

              <h2 className="mt-5 font-semibold text-slate-900 group-hover:text-[#15704f]">
                {title}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}