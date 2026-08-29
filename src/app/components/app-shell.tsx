"use client";

import Link from "next/link";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  BarChart3,
  Building2,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Repeat,
  Route,
  Settings,
  Newspaper,
  BadgePercent,
  Target,
  Users,
} from "lucide-react";

import {
  useCompany,
} from "@/app/components/company-provider";

import {
  createClient,
} from "@/app/lib/supabase/client";

type Company = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
};

type Props = {
  children: React.ReactNode;

  user: {
    fullName: string;
    role: string;
  };

  companies: Company[];

  permissions: {
    module: string;
    can_view: boolean;
  }[];
};

type NavigationItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  module: string;
  adminOnly?: boolean;
  estafetaOnly?: boolean;
};

const navigation: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    module: "dashboard",
  },
  {
    label: "Clientes",
    href: "/clientes",
    icon: Users,
    module: "clients",
  },
  {
    label: "Produtos e Serviços",
    href: "/produtos",
    icon: Package,
    module: "products",
  },
  {
    label: "Contratos",
    href: "/contratos",
    icon: FileText,
    module: "contracts",
  },

  {
  label: "Assinaturas",
  href: "/assinaturas",
  icon: Repeat,
  module: "contracts",
  estafetaOnly: true,
},

  {
  label: "Edições e Publicidade",
  href: "/edicoes",
  icon: Newspaper,
  module: "contracts",
  estafetaOnly: true,
},
  {
    label: "Financeiro",
    href: "/financeiro",
    icon: CircleDollarSign,
    module: "financial",
  },

  {
  label: "Comissões",
  href: "/comissoes",
  icon: BadgePercent,
  module: "financial",
},
  {
    label: "Metas",
    href: "/metas",
    icon: Target,
    module: "financial",
  },
  {
    label: "Rotas e Entregas",
    href: "/rotas",
    icon: Route,
    module: "routes",
  },
  
  {
    label: "Relatórios",
    href: "/relatorios",
    icon: BarChart3,
    module: "reports",
  },
  {
    label: "Empresas",
    href: "/empresas",
    icon: Building2,
    module: "settings",
    adminOnly: true,
  },
  {
    label: "Configurações",
    href: "/configuracoes",
    icon: Settings,
    module: "settings",
  },
];

export default function AppShell({
  children,
  user,
  permissions,
}: Props) {
  const pathname =
    usePathname();

  const router =
    useRouter();

  const supabase =
    createClient();

  const {
    companies,
    selectedCompanyId,
    selectedCompany,
    selectCompany,
  } = useCompany();

  const hasEstafetaAccess =
  user.role === "admin" ||
  companies.some(
    (company) =>
      company.slug ===
      "o-estafeta"
  );

 const visibleNavigation =
  navigation.filter(
    (item) => {
      /*
       * Item exclusivo
       * do O Estafeta.
       */
      if (
        item.estafetaOnly &&
        !hasEstafetaAccess
      ) {
        return false;
      }

      /*
       * Administrador vê
       * todos os demais itens.
       */
      if (
        user.role ===
        "admin"
      ) {
        return true;
      }

      if (
        item.adminOnly
      ) {
        return false;
      }

      return permissions.some(
        (permission) =>
          permission.module ===
            item.module &&
          permission.can_view
      );
    }
  );

  async function handleLogout() {
    await supabase.auth.signOut();

    router.replace(
      "/login"
    );

    router.refresh();
  }

  function handleCompanyChange(
    companyId: string
  ) {
    selectCompany(
      companyId
    );
  }

  return (
    <div
      className="
        min-h-screen
        bg-[#f5f7f6]
        print:min-h-0
        print:w-full
        print:bg-white
      "
    >
      <div
        className="
          flex
          min-h-screen
          print:block
          print:min-h-0
          print:w-full
        "
      >
        {/* SIDEBAR */}

        <aside
          className="
            fixed
            inset-y-0
            left-0
            z-40
            flex
            w-[270px]
            flex-col
            border-r
            border-slate-200
            bg-white
            print:hidden
          "
        >
          <Link
            href="/"
            aria-label="Ir para o dashboard"
            className="block rounded-xl px-7 pb-6 pt-7 transition hover:bg-slate-50"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#15704f]">
              Grupo
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              PULSO
            </h1>

            <p className="mt-1 text-xs text-slate-400">
              Plataforma de Gestão
            </p>
          </Link>

          <nav className="flex-1 space-y-1 overflow-y-auto px-4 pb-6">
            {visibleNavigation.map(
              ({
                label,
                href,
                icon: Icon,
              }) => {
                const active =
                  href === "/"
                    ? pathname ===
                      "/"
                    : pathname ===
                        href ||
                      pathname.startsWith(
                        `${href}/`
                      );

                return (
                  <Link
                    key={
                      href
                    }
                    href={
                      href
                    }
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                      active
                        ? "bg-[#15704f] text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />

                    <span>
                      {
                        label
                      }
                    </span>
                  </Link>
                );
              }
            )}
          </nav>

          <div className="border-t border-slate-100 p-4">
            <div className="mb-3 rounded-xl bg-slate-50 px-3 py-3">
              <p className="truncate text-sm font-medium text-slate-800">
                {
                  user.fullName
                }
              </p>

              <p className="mt-1 text-xs text-slate-400">
                {getRoleLabel(
                  user.role
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={
                handleLogout
              }
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />

              Sair
            </button>
          </div>
        </aside>

        {/* CONTEÚDO */}

        <div
          className="
            min-w-0
            flex-1
            pl-[270px]
            print:w-full
            print:min-w-0
            print:flex-none
            print:pl-0
          "
        >
          {/* HEADER */}

          <header
            className="
              sticky
              top-0
              z-30
              flex
              h-20
              items-center
              justify-between
              border-b
              border-slate-200
              bg-white/95
              px-8
              backdrop-blur
              print:hidden
            "
          >
            <div>
              <p className="text-sm font-medium text-slate-900">
                {selectedCompany
                  ?.name ??
                  "Grupo Pulso"}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                {selectedCompany
                  ? "Visualização individual"
                  : "Visão consolidada das empresas"}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                {selectedCompany && (
                  <span
                    className="absolute left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
                    style={{
                      backgroundColor:
                        selectedCompany.color ??
                        "#15704f",
                    }}
                  />
                )}

                <select
                  value={
                    selectedCompanyId
                  }
                  onChange={(
                    event
                  ) =>
                    handleCompanyChange(
                      event
                        .target
                        .value
                    )
                  }
                  className={`h-11 min-w-[230px] rounded-xl border border-slate-200 bg-white pr-4 text-sm text-slate-700 outline-none transition focus:border-[#15704f] ${
                    selectedCompany
                      ? "pl-8"
                      : "pl-4"
                  }`}
                >
                  <option value="all">
                    Todas as empresas
                  </option>

                  {companies.map(
                    (
                      company
                    ) => (
                      <option
                        key={
                          company.id
                        }
                        value={
                          company.id
                        }
                      >
                        {
                          company.name
                        }
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#15704f] text-sm font-semibold text-white">
                {getInitials(
                  user.fullName
                )}
              </div>
            </div>
          </header>

          {/* PÁGINA */}

          <div
            className="
              min-w-0
              print:w-full
              print:max-w-none
              print:min-w-0
            "
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function getInitials(
  name: string
) {
  const words =
    name
      .trim()
      .split(" ")
      .filter(
        Boolean
      );

  if (
    !words.length
  ) {
    return "GP";
  }

  if (
    words.length ===
    1
  ) {
    return words[0]
      .slice(
        0,
        2
      )
      .toUpperCase();
  }

  return `${words[0][0]}${
    words[
      words.length -
        1
    ][0]
  }`.toUpperCase();
}

function getRoleLabel(
  role: string
) {
  const labels: Record<
    string,
    string
  > = {
    admin:
      "Administrador",

    manager:
      "Gestor",

    finance:
      "Financeiro",

      seller:
  "Vendedor",

    operations:
      "Operações",

    viewer:
      "Visualização",
  };

  return (
    labels[
      role
    ] ??
    role
  );
}