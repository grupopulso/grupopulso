"use client";

import {
  useRef,
  useState,
} from "react";

import {
  Pencil,
} from "lucide-react";

import SellerForm, {
  type SellerToEdit,
} from "./seller-form";

type User = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
};

type Company = {
  id: string;
  name: string;
};

type SellerSetting = {
  id: string;
  user_id: string;
  company_id: string;
  active: boolean;
  commission_percentage:
    | number
    | string;
  override_percentage:
    | number
    | string;

  company:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
};

type Props = {
  users: User[];
  companies: Company[];
  settings: SellerSetting[];
};

export default function SellerManagement({
  users,
  companies,
  settings,
}: Props) {
  const [
    editingSeller,
    setEditingSeller,
  ] =
    useState<SellerToEdit | null>(
      null
    );

  const formRef =
    useRef<HTMLDivElement>(
      null
    );

  function handleEdit(
    setting: SellerSetting
  ) {
    setEditingSeller({
      userId:
        setting.user_id,

      companyId:
        setting.company_id,

      commissionPercentage:
        Number(
          setting.commission_percentage
        ),

      active:
        setting.active,
    });

    /*
     * Aguarda o React atualizar
     * o formulário e então sobe
     * suavemente até ele.
     */
    window.setTimeout(
      () => {
        formRef.current?.scrollIntoView(
          {
            behavior:
              "smooth",

            block:
              "start",
          }
        );
      },
      50
    );
  }

  function handleCancelEdit() {
    setEditingSeller(
      null
    );
  }

  return (
    <>
      {/* FORMULÁRIO */}

      <div
        ref={
          formRef
        }
        className="scroll-mt-24"
      >
        <SellerForm
          users={
            users
          }
          companies={
            companies
          }
          editingSeller={
            editingSeller
          }
          onCancelEdit={
            handleCancelEdit
          }
        />
      </div>

      {/* LISTAGEM */}

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="font-semibold text-slate-900">
            Usuários e comissões
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Gerencie os vendedores,
            empresas vinculadas e
            percentuais de comissão.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <TableHeader>
                  Usuário
                </TableHeader>

                <TableHeader>
                  Perfil
                </TableHeader>

                <TableHeader>
                  Empresa
                </TableHeader>

                <TableHeader>
                  Comissão
                </TableHeader>

                <TableHeader>
                  Adicional
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
              {users.map(
                (
                  user
                ) => {
                  const userSettings =
                    settings.filter(
                      (
                        setting
                      ) =>
                        setting.user_id ===
                        user.id
                    );

                  /*
                   * USUÁRIO AINDA NÃO
                   * CONFIGURADO
                   */

                  if (
                    !userSettings.length
                  ) {
                    return (
                      <tr
                        key={
                          user.id
                        }
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-slate-900">
                            {user.full_name ??
                              "Sem nome"}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {
                              user.email
                            }
                          </p>
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-600">
                          {getRoleLabel(
                            user.role
                          )}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-400">
                          —
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-400">
                          —
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-400">
                          —
                        </td>

                        <td className="px-6 py-4">
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                            Não configurado
                          </span>
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-400">
                          —
                        </td>
                      </tr>
                    );
                  }

                  /*
                   * CONFIGURAÇÕES DO
                   * VENDEDOR
                   */

                  return userSettings.map(
                    (
                      setting
                    ) => {
                      const company =
                        getFirst(
                          setting.company
                        );

                      const isCurrentlyEditing =
                        editingSeller
                          ?.userId ===
                          setting.user_id &&
                        editingSeller
                          ?.companyId ===
                          setting.company_id;

                      return (
                        <tr
                          key={
                            setting.id
                          }
                          className={`transition ${
                            isCurrentlyEditing
                              ? "bg-emerald-50/50"
                              : "hover:bg-slate-50/70"
                          }`}
                        >
                          <td className="px-6 py-4">
                            <p className="text-sm font-semibold text-slate-900">
                              {user.full_name ??
                                "Sem nome"}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {
                                user.email
                              }
                            </p>
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-600">
                            {getRoleLabel(
                              user.role
                            )}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-600">
                            {company?.name ??
                              "—"}
                          </td>

                          <td className="px-6 py-4">
                            <span className="text-sm font-semibold text-slate-900">
                              {formatPercentage(
                                Number(
                                  setting.commission_percentage
                                )
                              )}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <span className="text-sm text-slate-700">
                              {formatPercentage(
                                Number(
                                  setting.override_percentage
                                )
                              )}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                setting.active
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {setting.active
                                ? "Vendedor ativo"
                                : "Inativo"}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <button
                              type="button"
                              onClick={() =>
                                handleEdit(
                                  setting
                                )
                              }
                              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:border-[#15704f] hover:text-[#15704f]"
                            >
                              <Pencil className="h-3.5 w-3.5" />

                              Editar
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  );
                }
              )}

              {!users.length && (
                <tr>
                  <td
                    colSpan={
                      7
                    }
                    className="px-6 py-12 text-center text-sm text-slate-400"
                  >
                    Nenhum usuário
                    cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
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

function getFirst<T>(
  value:
    | T
    | T[]
    | null
    | undefined
): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(
    value
  )
    ? value[0] ??
        null
    : value;
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

    user:
      "Usuário",

    seller:
      "Vendedor",
  };

  return (
    labels[role] ??
    role
  );
}

function formatPercentage(
  value: number
) {
  return (
    new Intl.NumberFormat(
      "pt-BR",
      {
        minimumFractionDigits:
          0,

        maximumFractionDigits:
          2,
      }
    ).format(
      value
    ) + "%"
  );
}