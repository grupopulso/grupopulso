"use client";

import {
  useState,
  useTransition,
} from "react";

import {
  BadgePercent,
  Plus,
  Power,
  Trash2,
} from "lucide-react";

import {
  deleteOverrideRule,
  saveOverrideRule,
  toggleOverrideRule,
} from "./override-actions";

type User = {
  id: string;
  name: string | null;
};

type Company = {
  id: string;
  name: string;
};

type SellerSetting = {
  user_id: string;
  company_id: string;
  active: boolean;
};

type OverrideRule = {
  id: string;

  company_id: string;

  beneficiary_user_id:
    string;

  source_user_id:
    string;

  percentage:
    number | string;

  active: boolean;
};

type Props = {
  users: User[];
  companies: Company[];
  sellerSettings: SellerSetting[];
  rules: OverrideRule[];
};

export default function OverrideManagement({
  users,
  companies,
  sellerSettings,
  rules,
}: Props) {
  const [
    companyId,
    setCompanyId,
  ] = useState("");

  const [
    beneficiaryUserId,
    setBeneficiaryUserId,
  ] = useState("");

  const [
    sourceUserId,
    setSourceUserId,
  ] = useState("");

  const [
    percentage,
    setPercentage,
  ] = useState("1");

  const [
    message,
    setMessage,
  ] = useState<{
    type:
      | "success"
      | "error";
    text: string;
  } | null>(null);

  const [
    isPending,
    startTransition,
  ] = useTransition();

  /*
   * Somente vendedores ativos
   * da empresa selecionada.
   */

  const availableSellerIds =
    new Set(
      sellerSettings
        .filter(
          (setting) =>
            setting.company_id ===
              companyId &&
            setting.active
        )
        .map(
          (setting) =>
            setting.user_id
        )
    );

  const availableUsers =
    users.filter(
      (user) =>
        availableSellerIds.has(
          user.id
        )
    );

  function getUserName(
    userId: string
  ) {
    const user =
      users.find(
        (item) =>
          item.id ===
          userId
      );

    return (
      user?.name ??
      "Usuário"
    );
  }

  function getCompanyName(
    id: string
  ) {
    return (
      companies.find(
        (company) =>
          company.id === id
      )?.name ??
      "Empresa"
    );
  }

  function handleCompanyChange(
    value: string
  ) {
    setCompanyId(
      value
    );

    /*
     * Limpa vendedores porque
     * eles dependem da empresa.
     */
    setBeneficiaryUserId(
      ""
    );

    setSourceUserId(
      ""
    );

    setMessage(null);
  }

  function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage(null);

    const numericPercentage =
      Number(
        percentage
          .trim()
          .replace(
            ",",
            "."
          )
      );

    if (!companyId) {
      setMessage({
        type: "error",
        text:
          "Selecione uma empresa.",
      });

      return;
    }

    if (
      !beneficiaryUserId
    ) {
      setMessage({
        type: "error",
        text:
          "Selecione quem receberá a comissão adicional.",
      });

      return;
    }

    if (!sourceUserId) {
      setMessage({
        type: "error",
        text:
          "Selecione sobre as vendas de quem será calculado o adicional.",
      });

      return;
    }

    if (
      beneficiaryUserId ===
      sourceUserId
    ) {
      setMessage({
        type: "error",
        text:
          "Selecione vendedores diferentes.",
      });

      return;
    }

    if (
      Number.isNaN(
        numericPercentage
      ) ||
      numericPercentage < 0 ||
      numericPercentage > 100
    ) {
      setMessage({
        type: "error",
        text:
          "Informe um percentual válido.",
      });

      return;
    }

    startTransition(
      async () => {
        const result =
          await saveOverrideRule(
            {
              companyId,

              beneficiaryUserId,

              sourceUserId,

              percentage:
                numericPercentage,
            }
          );

        if (
          !result.success
        ) {
          setMessage({
            type: "error",
            text:
              result.message ??
              "Não foi possível salvar.",
          });

          return;
        }

        setMessage({
          type: "success",
          text:
            "Comissão adicional configurada com sucesso.",
        });

        setBeneficiaryUserId(
          ""
        );

        setSourceUserId(
          ""
        );

        setPercentage(
          "1"
        );
      }
    );
  }

  function handleToggle(
    rule: OverrideRule
  ) {
    setMessage(null);

    startTransition(
      async () => {
        const result =
          await toggleOverrideRule(
            rule.id,
            !rule.active
          );

        if (
          !result.success
        ) {
          setMessage({
            type: "error",
            text:
              result.message ??
              "Não foi possível alterar a regra.",
          });

          return;
        }

        setMessage({
          type: "success",
          text:
            rule.active
              ? "Comissão adicional desativada."
              : "Comissão adicional ativada.",
        });
      }
    );
  }

  function handleDelete(
    rule: OverrideRule
  ) {
    const confirmed =
      window.confirm(
        `Excluir a comissão adicional de ${formatPercentage(
          Number(
            rule.percentage
          )
        )} para ${getUserName(
          rule.beneficiary_user_id
        )} sobre as vendas de ${getUserName(
          rule.source_user_id
        )}?`
      );

    if (!confirmed) {
      return;
    }

    setMessage(null);

    startTransition(
      async () => {
        const result =
          await deleteOverrideRule(
            rule.id
          );

        if (
          !result.success
        ) {
          setMessage({
            type: "error",
            text:
              result.message ??
              "Não foi possível excluir a regra.",
          });

          return;
        }

        setMessage({
          type: "success",
          text:
            "Comissão adicional excluída.",
        });
      }
    );
  }

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* CABEÇALHO */}

      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex items-center gap-2">
          <BadgePercent className="h-5 w-5 text-[#15704f]" />

          <h2 className="font-semibold text-slate-900">
            Comissões adicionais
          </h2>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          Configure percentuais adicionais recebidos sobre as vendas de outros vendedores.
        </p>
      </div>

      {/* FORMULÁRIO */}

      <form
        onSubmit={
          handleSubmit
        }
        className="border-b border-slate-100 p-6"
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {/* EMPRESA */}

          <div>
            <label className="text-sm font-medium text-slate-700">
              Empresa
            </label>

            <select
              value={
                companyId
              }
              onChange={(
                event
              ) =>
                handleCompanyChange(
                  event.target
                    .value
                )
              }
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#15704f]"
            >
              <option value="">
                Selecione
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

          {/* BENEFICIÁRIO */}

          <div>
            <label className="text-sm font-medium text-slate-700">
              Quem recebe
            </label>

            <select
              value={
                beneficiaryUserId
              }
              disabled={
                !companyId
              }
              onChange={(
                event
              ) =>
                setBeneficiaryUserId(
                  event.target
                    .value
                )
              }
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#15704f] disabled:bg-slate-50"
            >
              <option value="">
                Selecione
              </option>

              {availableUsers.map(
                (
                  user
                ) => (
                  <option
                    key={
                      user.id
                    }
                    value={
                      user.id
                    }
                    disabled={
                      user.id ===
                      sourceUserId
                    }
                  >
                    {user.name ??
                      "Usuário"}
                  </option>
                )
              )}
            </select>
          </div>

          {/* VENDA DE */}

          <div>
            <label className="text-sm font-medium text-slate-700">
              Sobre vendas de
            </label>

            <select
              value={
                sourceUserId
              }
              disabled={
                !companyId
              }
              onChange={(
                event
              ) =>
                setSourceUserId(
                  event.target
                    .value
                )
              }
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#15704f] disabled:bg-slate-50"
            >
              <option value="">
                Selecione
              </option>

              {availableUsers.map(
                (
                  user
                ) => (
                  <option
                    key={
                      user.id
                    }
                    value={
                      user.id
                    }
                    disabled={
                      user.id ===
                      beneficiaryUserId
                    }
                  >
                    {user.name ??
                      "Usuário"}
                  </option>
                )
              )}
            </select>
          </div>

          {/* PERCENTUAL */}

          <div>
            <label className="text-sm font-medium text-slate-700">
              Percentual adicional
            </label>

            <div className="relative mt-2">
              <input
                type="text"
                inputMode="decimal"
                value={
                  percentage
                }
                onChange={(
                  event
                ) =>
                  setPercentage(
                    event.target
                      .value
                  )
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm text-slate-700 outline-none focus:border-[#15704f]"
              />

              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                %
              </span>
            </div>
          </div>
        </div>

        {companyId &&
          !availableUsers.length && (
            <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Nenhum vendedor ativo está configurado para esta empresa.
            </div>
          )}

        {message && (
          <div
            className={`mt-5 rounded-xl px-4 py-3 text-sm ${
              message.type ===
              "success"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {
              message.text
            }
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={
              isPending
            }
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />

            {isPending
              ? "Salvando..."
              : "Adicionar regra"}
          </button>
        </div>
      </form>

      {/* REGRAS */}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50">
            <tr>
              <TableHeader>
                Empresa
              </TableHeader>

              <TableHeader>
                Quem recebe
              </TableHeader>

              <TableHeader>
                Sobre vendas de
              </TableHeader>

              <TableHeader>
                Percentual
              </TableHeader>

              <TableHeader>
                Situação
              </TableHeader>

              <TableHeader>
                Ações
              </TableHeader>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {rules.map(
              (
                rule
              ) => (
                <tr
                  key={
                    rule.id
                  }
                  className="hover:bg-slate-50/70"
                >
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {getCompanyName(
                      rule.company_id
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {getUserName(
                        rule.beneficiary_user_id
                      )}
                    </p>
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-700">
                    {getUserName(
                      rule.source_user_id
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-slate-900">
                      {formatPercentage(
                        Number(
                          rule.percentage
                        )
                      )}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        rule.active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {rule.active
                        ? "Ativa"
                        : "Inativa"}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={
                          isPending
                        }
                        onClick={() =>
                          handleToggle(
                            rule
                          )
                        }
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:border-[#15704f] hover:text-[#15704f]"
                      >
                        <Power className="h-3.5 w-3.5" />

                        {rule.active
                          ? "Desativar"
                          : "Ativar"}
                      </button>

                      <button
                        type="button"
                        disabled={
                          isPending
                        }
                        onClick={() =>
                          handleDelete(
                            rule
                          )
                        }
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-100 bg-white px-3 text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />

                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}

            {!rules.length && (
              <tr>
                <td
                  colSpan={
                    6
                  }
                  className="px-6 py-12 text-center"
                >
                  <p className="text-sm font-medium text-slate-600">
                    Nenhuma comissão adicional configurada.
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    As regras adicionadas aparecerão aqui.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TableHeader({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <th className="whitespace-nowrap px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

function formatPercentage(
  value: number
) {
  return (
    new Intl.NumberFormat(
      "pt-BR",
      {
        maximumFractionDigits:
          2,
      }
    ).format(
      value
    ) + "%"
  );
}