"use client";

import {
  useEffect,
  useState,
  useTransition,
} from "react";

import {
  BadgePercent,
  Save,
  X,
} from "lucide-react";

import {
  saveSellerSettings,
} from "./actions";

type User = {
  id: string;
  name: string | null;
  role: string;
};

type Company = {
  id: string;
  name: string;
};

export type SellerToEdit = {
  userId: string;
  companyId: string;
  commissionPercentage: number;
  active: boolean;
};

type Props = {
  users: User[];
  companies: Company[];
  editingSeller?: SellerToEdit | null;
  onCancelEdit?: () => void;
};

export default function SellerForm({
  users,
  companies,
  editingSeller = null,
  onCancelEdit,
}: Props) {
  const [
    userId,
    setUserId,
  ] = useState("");

  const [
    companyId,
    setCompanyId,
  ] = useState("");

  const [
    commission,
    setCommission,
  ] = useState("10");

  const [
    active,
    setActive,
  ] = useState(true);

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

  const isEditing =
    Boolean(
      editingSeller
    );

  /*
   * Quando receber um vendedor
   * para edição, preenche o
   * formulário automaticamente.
   */
  useEffect(() => {
    if (
      !editingSeller
    ) {
      return;
    }

    setUserId(
      editingSeller.userId
    );

    setCompanyId(
      editingSeller.companyId
    );

    setCommission(
      String(
        editingSeller.commissionPercentage
      )
    );

    setActive(
      editingSeller.active
    );

    setMessage(null);
  }, [
    editingSeller,
  ]);

  function resetForm() {
    setUserId("");
    setCompanyId("");
    setCommission("10");
    setActive(true);
  }

  function handleCancel() {
    resetForm();
    setMessage(null);

    onCancelEdit?.();
  }

  function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage(null);

    const commissionValue =
      Number(
        commission
          .trim()
          .replace(
            ",",
            "."
          )
      );

    if (!userId) {
      setMessage({
        type: "error",
        text:
          "Selecione um usuário.",
      });

      return;
    }

    if (!companyId) {
      setMessage({
        type: "error",
        text:
          "Selecione uma empresa.",
      });

      return;
    }

    if (
      Number.isNaN(
        commissionValue
      ) ||
      commissionValue < 0 ||
      commissionValue > 100
    ) {
      setMessage({
        type: "error",
        text:
          "Informe uma comissão válida entre 0% e 100%.",
      });

      return;
    }

    startTransition(
      async () => {
        const result =
          await saveSellerSettings(
            {
              userId,
              companyId,

              commissionPercentage:
                commissionValue,

              active,
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
            isEditing
              ? "Vendedor atualizado com sucesso."
              : "Vendedor configurado com sucesso.",
        });

        /*
         * Na criação limpamos o
         * formulário.
         *
         * Na edição mantemos os
         * dados na tela para o
         * administrador enxergar
         * o que acabou de salvar.
         */
        if (
          !isEditing
        ) {
          resetForm();
        }
      }
    );
  }

  return (
    <section
      id="seller-form"
      className="mt-8 rounded-2xl border border-slate-200 bg-white"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div>
          <div className="flex items-center gap-2">
            <BadgePercent className="h-5 w-5 text-[#15704f]" />

            <h2 className="font-semibold text-slate-900">
              {isEditing
                ? "Editar vendedor"
                : "Configurar vendedor"}
            </h2>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            {isEditing
              ? "Altere a empresa, o percentual de comissão ou a situação do vendedor."
              : "Vincule um usuário a uma empresa e defina sua comissão sobre as próprias vendas."}
          </p>
        </div>

        {isEditing && (
          <button
            type="button"
            onClick={
              handleCancel
            }
            disabled={
              isPending
            }
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <X className="h-4 w-4" />

            Cancelar edição
          </button>
        )}
      </div>

      <form
        onSubmit={
          handleSubmit
        }
        className="p-6"
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">

          {/* USUÁRIO */}

          <div>
            <label className="text-sm font-medium text-slate-700">
              Usuário
            </label>

            <select
              value={
                userId
              }
              onChange={(
                event
              ) =>
                setUserId(
                  event.target
                    .value
                )
              }
              disabled={
                isEditing
              }
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#15704f] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">
                Selecione
              </option>

              {users.map(
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
                  >
                    {user.name ??
                      "Usuário"}
                  </option>
                )
              )}
            </select>

            {isEditing && (
              <p className="mt-1 text-xs text-slate-400">
                O usuário não pode ser alterado durante a edição.
              </p>
            )}
          </div>

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
                setCompanyId(
                  event.target
                    .value
                )
              }
              disabled={
                isEditing
              }
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#15704f] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
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

            {isEditing && (
              <p className="mt-1 text-xs text-slate-400">
                Para trocar a empresa, crie uma nova configuração.
              </p>
            )}
          </div>

          {/* COMISSÃO */}

          <div>
            <label className="text-sm font-medium text-slate-700">
              Comissão (%)
            </label>

            <div className="relative mt-2">
              <input
                type="text"
                inputMode="decimal"
                value={
                  commission
                }
                onChange={(
                  event
                ) =>
                  setCommission(
                    event.target
                      .value
                  )
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm text-slate-700 outline-none transition focus:border-[#15704f]"
                placeholder="10"
              />

              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                %
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-400">
              Percentual sobre as próprias vendas.
            </p>
          </div>

          {/* SITUAÇÃO */}

          <div>
            <label className="text-sm font-medium text-slate-700">
              Situação
            </label>

            <label className="mt-2 flex h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3">
              <input
                type="checkbox"
                checked={
                  active
                }
                onChange={(
                  event
                ) =>
                  setActive(
                    event.target
                      .checked
                  )
                }
                className="h-4 w-4 rounded border-slate-300 accent-[#15704f]"
              />

              <span className="text-sm text-slate-700">
                {active
                  ? "Vendedor ativo"
                  : "Vendedor inativo"}
              </span>
            </label>
          </div>
        </div>

        {/* MENSAGEM */}

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

        {/* AÇÕES */}

        <div className="mt-6 flex justify-end gap-3">
          {isEditing && (
            <button
              type="button"
              onClick={
                handleCancel
              }
              disabled={
                isPending
              }
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          )}

          <button
            type="submit"
            disabled={
              isPending
            }
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#15704f] px-5 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />

            {isPending
              ? "Salvando..."
              : isEditing
                ? "Salvar alterações"
                : "Salvar vendedor"}
          </button>
        </div>
      </form>
    </section>
  );
}