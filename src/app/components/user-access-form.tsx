"use client";

import {
  Building2,
  Save,
  ShieldCheck,
  UserCog,
} from "lucide-react";

import {
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  updateUserAccess,
} from "@/app/(dashboard)/configuracoes/usuarios/[id]/actions";

type Company = {
  id: string;
  name: string;
  color: string | null;
};

type Permission = {
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

type Profile = {
  id: string;
  name: string | null;
  role: string;
  active: boolean;
};

type ModuleDefinition = {
  key: string;
  name: string;
};

type Props = {
  profile: Profile;
  companies: Company[];
  selectedCompanyIds: string[];
  permissions: Permission[];
  modules: ModuleDefinition[];
};

export default function UserAccessForm({
  profile,
  companies,
  selectedCompanyIds,
  permissions,
  modules,
}: Props) {
  const [
    pending,
    startTransition,
  ] = useTransition();

  const [
    name,
    setName,
  ] = useState(
    profile.name ?? ""
  );

  const [
    role,
    setRole,
  ] = useState(
    profile.role
  );

  const [
    active,
    setActive,
  ] = useState(
    profile.active
  );

  const [
    selectedCompanies,
    setSelectedCompanies,
  ] = useState<string[]>(
    selectedCompanyIds
  );

  const initialPermissions =
    useMemo(() => {
      const map =
        new Map<
          string,
          {
            canView: boolean;
            canCreate: boolean;
            canEdit: boolean;
            canDelete: boolean;
          }
        >();

      for (
        const module of
        modules
      ) {
        const permission =
          permissions.find(
            (item) =>
              item.module ===
              module.key
          );

        map.set(
          module.key,
          {
            canView:
              profile.role ===
                "admin" ||
              permission?.can_view ||
              false,

            canCreate:
              profile.role ===
                "admin" ||
              permission?.can_create ||
              false,

            canEdit:
              profile.role ===
                "admin" ||
              permission?.can_edit ||
              false,

            canDelete:
              profile.role ===
                "admin" ||
              permission?.can_delete ||
              false,
          }
        );
      }

      return map;
    }, [
      modules,
      permissions,
      profile.role,
    ]);

  const [
    permissionMap,
    setPermissionMap,
  ] = useState(
    initialPermissions
  );

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  function toggleCompany(
    companyId: string
  ) {
    setSelectedCompanies(
      (current) =>
        current.includes(
          companyId
        )
          ? current.filter(
              (id) =>
                id !==
                companyId
            )
          : [
              ...current,
              companyId,
            ]
    );
  }

  function updatePermission(
    module: string,
    field:
      | "canView"
      | "canCreate"
      | "canEdit"
      | "canDelete",
    value: boolean
  ) {
    setPermissionMap(
      (current) => {
        const next =
          new Map(
            current
          );

        const existing =
          next.get(
            module
          ) ?? {
            canView:
              false,
            canCreate:
              false,
            canEdit:
              false,
            canDelete:
              false,
          };

        const updated = {
          ...existing,
          [field]: value,
        };

        /*
         * Se criar, editar ou excluir,
         * automaticamente precisa
         * visualizar o módulo.
         */
        if (
          field !==
            "canView" &&
          value
        ) {
          updated.canView =
            true;
        }

        /*
         * Se remover visualização,
         * removemos as demais.
         */
        if (
          field ===
            "canView" &&
          !value
        ) {
          updated.canCreate =
            false;

          updated.canEdit =
            false;

          updated.canDelete =
            false;
        }

        next.set(
          module,
          updated
        );

        return next;
      }
    );
  }

  function giveFullAccess() {
    const next =
      new Map(
        permissionMap
      );

    modules.forEach(
      (module) => {
        next.set(
          module.key,
          {
            canView: true,
            canCreate: true,
            canEdit: true,
            canDelete: true,
          }
        );
      }
    );

    setPermissionMap(
      next
    );
  }

  function removeAllAccess() {
    const next =
      new Map(
        permissionMap
      );

    modules.forEach(
      (module) => {
        next.set(
          module.key,
          {
            canView: false,
            canCreate: false,
            canEdit: false,
            canDelete: false,
          }
        );
      }
    );

    setPermissionMap(
      next
    );
  }

  function handleRoleChange(
    newRole: string
  ) {
    setRole(
      newRole
    );

    if (
      newRole ===
      "admin"
    ) {
      giveFullAccess();
    }
  }

  function save() {
    setError("");
    setMessage("");

    const permissionList =
      modules.map(
        (module) => {
          const item =
            permissionMap.get(
              module.key
            );

          return {
            module:
              module.key,

            canView:
              role ===
                "admin" ||
              item?.canView ||
              false,

            canCreate:
              role ===
                "admin" ||
              item?.canCreate ||
              false,

            canEdit:
              role ===
                "admin" ||
              item?.canEdit ||
              false,

            canDelete:
              role ===
                "admin" ||
              item?.canDelete ||
              false,
          };
        }
      );

    startTransition(
      async () => {
        const result =
          await updateUserAccess(
            profile.id,
            {
              name,
              role,
              active,

              companyIds:
                selectedCompanies,

              permissions:
                permissionList,
            }
          );

        if (
          !result.success
        ) {
          setError(
            result.message ??
              "Não foi possível salvar."
          );

          return;
        }

        setMessage(
          result.message ??
            "Alterações salvas."
        );
      }
    );
  }

  return (
    <>
      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <div className="mt-7 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6">
          {/* PERFIL */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <UserCog className="h-5 w-5 text-[#15704f]" />

              <div>
                <h2 className="font-semibold text-slate-900">
                  Perfil
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Dados gerais e nível de acesso.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <Field label="Nome">
                <input
                  value={name}
                  onChange={(
                    event
                  ) =>
                    setName(
                      event.target.value
                    )
                  }
                  className="input"
                />
              </Field>

              <Field label="Perfil">
                <select
                  value={role}
                  onChange={(
                    event
                  ) =>
                    handleRoleChange(
                      event
                        .target
                        .value
                    )
                  }
                  className="input"
                >
                  <option value="admin">
                    Administrador
                  </option>

                  <option value="manager">
                    Gestor
                  </option>

                  <option value="finance">
                    Financeiro
                  </option>

                  <option value="operations">
                    Operações
                  </option>

                  <option value="viewer">
                    Visualização
                  </option>
                </select>
              </Field>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(
                      event
                    ) =>
                      setActive(
                        event
                          .target
                          .checked
                      )
                    }
                    className="mt-1 h-4 w-4"
                  />

                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Usuário ativo
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Usuários inativos poderão ser bloqueados de acessar o sistema.
                    </p>
                  </div>
                </label>
              </div>

              {role ===
                "admin" && (
                <div className="rounded-xl border border-violet-100 bg-violet-50 p-4">
                  <p className="text-sm font-semibold text-violet-800">
                    Administrador
                  </p>

                  <p className="mt-1 text-xs leading-5 text-violet-700">
                    Administradores possuem acesso completo a todos os módulos e ações.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* EMPRESAS */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-[#15704f]" />

              <div>
                <h2 className="font-semibold text-slate-900">
                  Empresas
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Empresas que o usuário poderá acessar.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {companies.map(
                (company) => {
                  const checked =
                    selectedCompanies.includes(
                      company.id
                    );

                  return (
                    <label
                      key={
                        company.id
                      }
                      className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition ${
                        checked
                          ? "border-[#15704f]/30 bg-[#15704f]/5"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor:
                              company.color ??
                              "#94a3b8",
                          }}
                        />

                        <span className="text-sm font-medium text-slate-700">
                          {
                            company.name
                          }
                        </span>
                      </div>

                      <input
                        type="checkbox"
                        checked={
                          checked
                        }
                        onChange={() =>
                          toggleCompany(
                            company.id
                          )
                        }
                        className="h-4 w-4"
                      />
                    </label>
                  );
                }
              )}

              {!companies.length && (
                <p className="py-4 text-sm text-slate-400">
                  Nenhuma empresa cadastrada.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* PERMISSÕES */}

        <div className="xl:col-span-2">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-slate-100 p-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-[#15704f]" />

                <div>
                  <h2 className="font-semibold text-slate-900">
                    Permissões
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Defina o que este usuário poderá fazer.
                  </p>
                </div>
              </div>

              {role !==
                "admin" && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={
                      removeAllAccess
                    }
                    className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Remover todas
                  </button>

                  <button
                    type="button"
                    onClick={
                      giveFullAccess
                    }
                    className="h-9 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white"
                  >
                    Liberar todas
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <Header>
                      Módulo
                    </Header>

                    <Header>
                      Visualizar
                    </Header>

                    <Header>
                      Criar
                    </Header>

                    <Header>
                      Editar
                    </Header>

                    <Header>
                      Excluir
                    </Header>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {modules.map(
                    (module) => {
                      const permission =
                        permissionMap.get(
                          module.key
                        ) ?? {
                          canView:
                            false,
                          canCreate:
                            false,
                          canEdit:
                            false,
                          canDelete:
                            false,
                        };

                      const admin =
                        role ===
                        "admin";

                      return (
                        <tr
                          key={
                            module.key
                          }
                          className="transition hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            <p className="text-sm font-semibold text-slate-800">
                              {
                                module.name
                              }
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {
                                module.key
                              }
                            </p>
                          </td>

                          <PermissionCheckbox
                            checked={
                              admin ||
                              permission.canView
                            }
                            disabled={
                              admin
                            }
                            onChange={(
                              value
                            ) =>
                              updatePermission(
                                module.key,
                                "canView",
                                value
                              )
                            }
                          />

                          <PermissionCheckbox
                            checked={
                              admin ||
                              permission.canCreate
                            }
                            disabled={
                              admin
                            }
                            onChange={(
                              value
                            ) =>
                              updatePermission(
                                module.key,
                                "canCreate",
                                value
                              )
                            }
                          />

                          <PermissionCheckbox
                            checked={
                              admin ||
                              permission.canEdit
                            }
                            disabled={
                              admin
                            }
                            onChange={(
                              value
                            ) =>
                              updatePermission(
                                module.key,
                                "canEdit",
                                value
                              )
                            }
                          />

                          <PermissionCheckbox
                            checked={
                              admin ||
                              permission.canDelete
                            }
                            disabled={
                              admin
                            }
                            onChange={(
                              value
                            ) =>
                              updatePermission(
                                module.key,
                                "canDelete",
                                value
                              )
                            }
                          />
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-6 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:opacity-60"
            >
              <Save className="h-4 w-4" />

              {pending
                ? "Salvando..."
                : "Salvar alterações"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function PermissionCheckbox({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (
    value: boolean
  ) => void;
}) {
  return (
    <td className="px-5 py-4">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(
          event
        ) =>
          onChange(
            event.target.checked
          )
        }
        className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
      />
    </td>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>

      {children}
    </label>
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