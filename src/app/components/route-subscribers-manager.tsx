"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  Check,
  MapPin,
  Search,
  UserPlus,
} from "lucide-react";

import { useRouter } from "next/navigation";

import { addSubscribersToRoute } from "@/app/(dashboard)/rotas/[id]/actions";

type Address = {
  id: string;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
};

type Client = {
  id: string;
  name: string;
  cpf_cnpj: string | null;
  phone: string | null;
  whatsapp: string | null;

  client_companies:
    | {
        company_id: string;
        status: string;
      }[]
    | null;

  client_addresses:
    | Address[]
    | null;
};

type Relation = {
  id: string;
  client_id: string;
  address_id: string | null;
  delivery_order: number | null;
  notes: string | null;
  active: boolean;
};

type SelectedClient = {
  clientId: string;
  addressId: string | null;
};

export default function RouteSubscribersManager({
  routeId,
  clients,
  initialRelations,
}: {
  routeId: string;
  clients: Client[];
  initialRelations: Relation[];
}) {
  const router = useRouter();

  const [search, setSearch] =
    useState("");

  const [selected, setSelected] =
    useState<SelectedClient[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const currentClientIds =
    useMemo(
      () =>
        new Set(
          initialRelations.map(
            (relation) =>
              relation.client_id
          )
        ),
      [initialRelations]
    );

  const availableClients =
    useMemo(() => {
      const term = search
        .trim()
        .toLowerCase();

      return clients.filter(
        (client) => {
          if (
            currentClientIds.has(
              client.id
            )
          ) {
            return false;
          }

          if (!term) {
            return true;
          }

          return (
            client.name
              .toLowerCase()
              .includes(term) ||
            client.cpf_cnpj
              ?.toLowerCase()
              .includes(term) ||
            client.phone
              ?.toLowerCase()
              .includes(term) ||
            client.whatsapp
              ?.toLowerCase()
              .includes(term)
          );
        }
      );
    }, [
      clients,
      currentClientIds,
      search,
    ]);

  function isSelected(
    clientId: string
  ) {
    return selected.some(
      (item) =>
        item.clientId === clientId
    );
  }

  function toggleClient(
    client: Client
  ) {
    if (
      isSelected(client.id)
    ) {
      setSelected(
        selected.filter(
          (item) =>
            item.clientId !==
            client.id
        )
      );

      return;
    }

    const firstAddress =
      client.client_addresses?.[0];

    setSelected([
      ...selected,
      {
        clientId: client.id,
        addressId:
          firstAddress?.id ??
          null,
      },
    ]);
  }

  function setClientAddress(
    clientId: string,
    addressId: string
  ) {
    setSelected(
      selected.map(
        (item) =>
          item.clientId ===
          clientId
            ? {
                ...item,
                addressId:
                  addressId ||
                  null,
              }
            : item
      )
    );
  }

  async function addSelected() {
    if (!selected.length) {
      return;
    }

    setLoading(true);
    setError("");

    const result =
      await addSubscribersToRoute(
        routeId,
        selected.map((item) => ({
          clientId: item.clientId,
          addressId: item.addressId,
        }))
      );

    if (!result.success) {
      setError(
        result.message ??
          "Não foi possível adicionar à rota."
      );

      setLoading(false);
      return;
    }

    setSelected([]);

    router.push(
      `/rotas/${routeId}`
    );

    router.refresh();
  }

  return (
    <div className="mt-7 grid grid-cols-1 gap-6 xl:grid-cols-3">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white xl:col-span-2">
        <div className="border-b border-slate-100 p-5">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Buscar assinante..."
              className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-4 text-sm outline-none transition focus:border-[#15704f]"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {availableClients.map(
            (client) => {
              const active =
                isSelected(
                  client.id
                );

              const selectedItem =
                selected.find(
                  (item) =>
                    item.clientId ===
                    client.id
                );

              return (
                <div
                  key={client.id}
                  className={`p-5 transition ${
                    active
                      ? "bg-emerald-50/50"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <button
                      type="button"
                      onClick={() =>
                        toggleClient(
                          client
                        )
                      }
                      className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition ${
                        active
                          ? "border-[#15704f] bg-[#15704f] text-white"
                          : "border-slate-300 bg-white text-transparent"
                      }`}
                    >
                      <Check className="h-4 w-4" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() =>
                          toggleClient(
                            client
                          )
                        }
                        className="text-left"
                      >
                        <p className="font-semibold text-slate-900">
                          {client.name}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {client.cpf_cnpj ||
                            client.whatsapp ||
                            client.phone ||
                            "Sem documento ou contato"}
                        </p>
                      </button>

                      <div className="mt-3">
                        {client.client_addresses
                          ?.length ? (
                          <select
                            value={
                              selectedItem
                                ?.addressId ??
                              client
                                .client_addresses[0]
                                .id
                            }
                            onChange={(
                              event
                            ) => {
                              if (
                                !active
                              ) {
                                toggleClient(
                                  client
                                );
                              }

                              setClientAddress(
                                client.id,
                                event
                                  .target
                                  .value
                              );
                            }}
                            className="h-10 w-full max-w-xl rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:border-[#15704f]"
                          >
                            {client.client_addresses.map(
                              (
                                address
                              ) => (
                                <option
                                  key={
                                    address.id
                                  }
                                  value={
                                    address.id
                                  }
                                >
                                  {formatAddress(
                                    address
                                  )}
                                </option>
                              )
                            )}
                          </select>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-amber-600">
                            <MapPin className="h-4 w-4" />
                            Cliente sem endereço cadastrado
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
          )}

          {!availableClients.length && (
            <div className="p-14 text-center">
              <p className="text-sm font-medium text-slate-500">
                Nenhum assinante encontrado.
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Todos podem já estar vinculados à rota ou a busca não encontrou resultados.
              </p>
            </div>
          )}
        </div>
      </section>

      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">
          Selecionados
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Os assinantes serão adicionados ao final da rota.
        </p>

        <div className="mt-5 rounded-xl bg-slate-50 p-5 text-center">
          <p className="text-3xl font-semibold text-slate-900">
            {selected.length}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {selected.length === 1
              ? "assinante selecionado"
              : "assinantes selecionados"}
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={addSelected}
          disabled={
            !selected.length ||
            loading
          }
          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#15704f] px-4 text-sm font-semibold text-white transition hover:bg-[#105c41] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4" />

          {loading
            ? "Adicionando..."
            : "Adicionar à rota"}
        </button>

        <p className="mt-3 text-center text-xs leading-5 text-slate-400">
          A ordem poderá ser ajustada depois na tela da rota.
        </p>
      </aside>
    </div>
  );
}

function formatAddress(
  address: Address
) {
  const parts = [];

  if (address.street) {
    parts.push(address.street);
  }

  if (address.number) {
    parts.push(address.number);
  }

  let result =
    parts.join(", ");

  if (
    address.neighborhood
  ) {
    result += result
      ? ` - ${address.neighborhood}`
      : address.neighborhood;
  }

  if (address.city) {
    result += result
      ? ` - ${address.city}`
      : address.city;
  }

  return (
    result ||
    "Endereço sem identificação"
  );
}