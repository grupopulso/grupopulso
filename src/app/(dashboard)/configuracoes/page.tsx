import Link from "next/link";

import {
  Building2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  Monitor,
} from "lucide-react";

import {
  requireModulePermission,
} from "@/app/lib/permissions";

const sections = [
  {
    title: "Empresas",
    description:
      "Gerencie as empresas vinculadas ao Grupo Pulso.",
    href: "/empresas",
    icon: Building2,
    adminOnly: true,
  },
  {
    title: "Categorias financeiras",
    description:
      "Cadastre e organize categorias de receitas e despesas.",
    href: "/configuracoes/categorias-financeiras",
    icon: CircleDollarSign,
    adminOnly: false,
  },
  {
    title: "Formas de pagamento",
    description:
      "Configure as formas de recebimento e pagamento utilizadas.",
    href: "/configuracoes/formas-pagamento",
    icon: CreditCard,
    adminOnly: false,
  },
  {
    title: "Entregadores",
    description:
      "Gerencie os responsáveis pelas rotas e entregas.",
    href: "/rotas/entregadores",
    icon: Truck,
    adminOnly: false,
  },
  {
    title: "Usuários e permissões",
    description:
      "Controle quem pode acessar e administrar o sistema.",
    href: "/configuracoes/usuarios",
    icon: Users,
    adminOnly: true,
  },
  {
    title: "Segurança e acesso",
    description:
      "Controle de acesso, políticas administrativas e auditoria.",
    href: "/configuracoes/seguranca",
    icon: ShieldCheck,
    adminOnly: true,
  },

  {
  title:
    "TVs / Telões Pottencializa",

  description:
    "Cadastre e edite os pontos de mídia utilizados nos contratos.",

  href:
    "/configuracoes/tvs",

  icon:
    Monitor,
},
];

export default async function ConfiguracoesPage() {
  const access =
    await requireModulePermission(
      "settings",
      "view"
    );

  const isAdmin =
    access.profile.role ===
    "admin";

  const visibleSections =
    sections.filter(
      (section) =>
        !section.adminOnly ||
        isAdmin
    );

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15704f]/10">
            <Settings className="h-5 w-5 text-[#15704f]" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Configurações
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Gerencie cadastros e preferências gerais da plataforma.
            </p>
          </div>
        </div>

        <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleSections.map(
            ({
              title,
              description,
              href,
              icon: Icon,
            }) => (
              <Link
                key={href}
                href={href}
                className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-[#15704f]/30 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15704f]/10">
                    <Icon className="h-5 w-5 text-[#15704f]" />
                  </div>

                  <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#15704f]" />
                </div>

                <h2 className="mt-5 font-semibold text-slate-900 transition group-hover:text-[#15704f]">
                  {title}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {description}
                </p>
              </Link>
            )
          )}
        </div>

        {!visibleSections.length && (
          <div className="mt-7 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Settings className="mx-auto h-7 w-7 text-slate-300" />

            <p className="mt-3 text-sm font-semibold text-slate-500">
              Nenhuma configuração disponível.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}