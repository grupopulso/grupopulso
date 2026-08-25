import {
  Banknote,
  CreditCard,
  Plus,
} from "lucide-react";

import { createClient } from "@/app/lib/supabase/server";

import PaymentMethodForm from "@/app/components/payment-method-form";
import PaymentMethodActions from "@/app/components/payment-method-actions";
import {
  requireModulePermission,
} from "@/app/lib/permissions";

export default async function FormasPagamentoPage() {
    await requireModulePermission(
  "settings",
  "view"
);
  const supabase =
    await createClient();

  const {
    data: methods,
    error,
  } = await supabase
    .from(
      "financial_payment_methods"
    )
    .select(`
      id,
      name,
      code,
      usage_type,
      active,
      created_at
    `)
    .order("name");

  if (error) {
    console.error(
      "Erro ao carregar formas de pagamento:",
      error
    );
  }

  const activeMethods =
    methods?.filter(
      (method) =>
        method.active
    ).length ?? 0;

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#15704f]/10">
            <CreditCard className="h-5 w-5 text-[#15704f]" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Formas de Pagamento
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Gerencie os meios utilizados em recebimentos e pagamentos.
            </p>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2">
          <SummaryCard
            label="Cadastradas"
            value={String(
              methods?.length ?? 0
            )}
          />

          <SummaryCard
            label="Ativas"
            value={String(
              activeMethods
            )}
          />
        </div>

        <div className="mt-7">
          <PaymentMethodForm />
        </div>

        <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-semibold text-slate-900">
              Formas cadastradas
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Essas formas poderão ser utilizadas nos lançamentos financeiros.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <Header>
                    Forma
                  </Header>

                  <Header>
                    Identificador
                  </Header>

                  <Header>
                    Utilização
                  </Header>

                  <Header>
                    Situação
                  </Header>

                  <Header>
                    Ações
                  </Header>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {methods?.map(
                  (method) => (
                    <tr
                      key={method.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#15704f]/10">
                            <Banknote className="h-4 w-4 text-[#15704f]" />
                          </div>

                          <p className="text-sm font-semibold text-slate-900">
                            {method.name}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <code className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                          {method.code}
                        </code>
                      </td>

                      <td className="px-5 py-4">
                        <UsageBadge
                          usage={
                            method.usage_type
                          }
                        />
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            method.active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {method.active
                            ? "Ativa"
                            : "Inativa"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <PaymentMethodActions
                          method={{
                            id:
                              method.id,

                            name:
                              method.name,

                            code:
                              method.code,

                            usageType:
                              method.usage_type,

                            active:
                              method.active,
                          }}
                        />
                      </td>
                    </tr>
                  )
                )}

                {!methods?.length && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-14 text-center"
                    >
                      <Plus className="mx-auto h-6 w-6 text-slate-300" />

                      <p className="mt-3 text-sm text-slate-400">
                        Nenhuma forma de pagamento cadastrada.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function UsageBadge({
  usage,
}: {
  usage: string;
}) {
  const labels: Record<
    string,
    string
  > = {
    income:
      "Recebimentos",

    expense:
      "Pagamentos",

    both:
      "Ambos",
  };

  const styles: Record<
    string,
    string
  > = {
    income:
      "bg-emerald-50 text-emerald-700",

    expense:
      "bg-red-50 text-red-700",

    both:
      "bg-blue-50 text-blue-700",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[usage] ??
        styles.both
      }`}
    >
      {labels[usage] ??
        usage}
    </span>
  );
}

function Header({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}