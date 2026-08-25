import Link from "next/link";

import {
  ArrowRight,
  Building2,
  FileClock,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserRoundCog,
  Users,
} from "lucide-react";

import {
  requireAdmin,
} from "@/app/lib/permissions";

export default async function SegurancaPage() {
  const access =
    await requireAdmin();

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15704f]/10">
            <ShieldCheck className="h-5 w-5 text-[#15704f]" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Segurança
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Controle de acesso, permissões e auditoria da plataforma.
            </p>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-3">
          <StatusCard
            icon={ShieldCheck}
            label="Seu acesso"
            value="Administrador"
            description="Acesso completo às áreas administrativas."
          />

          <StatusCard
            icon={KeyRound}
            label="Autenticação"
            value="Supabase Auth"
            description="Sessões individuais por usuário."
          />

          <StatusCard
            icon={LockKeyhole}
            label="Permissões"
            value="Por módulo"
            description="Visualizar, criar, editar e excluir."
          />
        </div>

        <Section
          title="Controle de acesso"
          description="Gerencie usuários, empresas e permissões."
        >
          <SecurityLink
            href="/configuracoes/usuarios"
            icon={Users}
            title="Usuários e Permissões"
            description="Configure perfis, empresas permitidas e permissões por módulo."
          />

          <SecurityLink
            href="/empresas"
            icon={Building2}
            title="Empresas"
            description="Gerencie as empresas disponíveis na plataforma."
          />
        </Section>

        <Section
          title="Auditoria"
          description="Consulte as ações registradas dentro do sistema."
        >
          <SecurityLink
            href="/configuracoes/seguranca/auditoria"
            icon={FileClock}
            title="Registro de atividades"
            description="Visualize alterações de usuários, clientes, recebimentos, pagamentos e demais ações auditadas."
          />
        </Section>

        <Section
          title="Políticas administrativas"
          description="Regras de segurança atualmente aplicadas."
        >
          <PolicyItem
            icon={UserRoundCog}
            title="Usuários e permissões"
            description="Somente administradores podem alterar perfis, empresas vinculadas e permissões."
          />

          <PolicyItem
            icon={Building2}
            title="Empresas"
            description="Somente administradores podem criar, editar ou excluir empresas."
          />

          <PolicyItem
            icon={LockKeyhole}
            title="Permissões por módulo"
            description="Usuários comuns dependem das permissões de visualizar, criar, editar e excluir."
          />

          <PolicyItem
            icon={ShieldCheck}
            title="Usuários inativos"
            description="Usuários inativos não conseguem acessar áreas protegidas da plataforma."
          />

          <PolicyItem
            icon={FileClock}
            title="Auditoria"
            description="Alterações críticas podem gerar registros permanentes com usuário, módulo, ação e entidade."
          />
        </Section>

        <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Sessão atual
          </p>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#15704f]/10">
              <UserRoundCog className="h-5 w-5 text-[#15704f]" />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900">
                {access.profile.name ||
                  "Administrador"}
              </p>

              <p className="mt-0.5 text-xs text-slate-500">
                Administrador do sistema
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900">
          {title}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {children}
      </div>
    </section>
  );
}

function SecurityLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:border-[#15704f]/30 hover:bg-[#15704f]/[0.03]"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 transition group-hover:bg-[#15704f]/10">
          <Icon className="h-5 w-5 text-slate-500 transition group-hover:text-[#15704f]" />
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-800">
            {title}
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>
      </div>

      <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-[#15704f]" />
    </Link>
  );
}

function PolicyItem({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-slate-100 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
        <Icon className="h-4 w-4 text-emerald-700" />
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-800">
          {title}
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#15704f]/10">
        <Icon className="h-4 w-4 text-[#15704f]" />
      </div>

      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-lg font-semibold text-slate-900">
        {value}
      </p>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}