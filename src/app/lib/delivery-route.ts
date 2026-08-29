import type { createClient } from "@/app/lib/supabase/server";

import {
  compareByStreetThenNumber,
  findRouteInsertIndex,
} from "@/app/lib/route-ordering";

type SupabaseServer = Awaited<
  ReturnType<typeof createClient>
>;

export type NewRouteStop = {
  clientId: string;
  addressId: string | null;
  street: string | null;
  number: string | null;
};

type ListItem =
  | {
      kind: "existing";
      id: string;
      currentOrder: number;
      street: string | null;
      number: string | null;
    }
  | {
      kind: "new";
      clientId: string;
      addressId: string | null;
      street: string | null;
      number: string | null;
    };

function getFirst<T>(
  value: T | T[] | null | undefined
): T | null {
  if (!value) return null;
  return Array.isArray(value)
    ? value[0] ?? null
    : value;
}

/*
 * Adiciona um ou mais clientes a uma rota tentando manter a
 * ordem geográfica (ver route-ordering.ts). Renumera o
 * delivery_order de toda a rota de uma vez.
 *
 * Clientes que já estão na rota são ignorados.
 */
export async function addStopsInGeographicOrder(
  supabase: SupabaseServer,
  routeId: string,
  newStops: NewRouteStop[]
): Promise<{ added: number; errors: string[] }> {
  const errors: string[] = [];

  const { data: currentRaw, error: loadError } =
    await supabase
      .from("delivery_route_clients")
      .select(
        `
        id,
        client_id,
        delivery_order,
        address:client_addresses (
          street,
          number
        )
      `
      )
      .eq("route_id", routeId)
      .eq("active", true)
      .order("delivery_order", {
        ascending: true,
      });

  if (loadError) {
    return {
      added: 0,
      errors: [loadError.message],
    };
  }

  const existingClientIds = new Set(
    (currentRaw ?? []).map(
      (row) => row.client_id as string
    )
  );

  const list: ListItem[] = (
    currentRaw ?? []
  ).map((row, index) => {
    const address = getFirst(row.address) as
      | { street: string | null; number: string | null }
      | null;

    return {
      kind: "existing",
      id: row.id as string,
      currentOrder: Number(
        row.delivery_order ?? index + 1
      ),
      street: address?.street ?? null,
      number: address?.number ?? null,
    };
  });

  const pending = newStops
    .filter(
      (stop) =>
        stop.clientId &&
        !existingClientIds.has(stop.clientId)
    )
    .sort(compareByStreetThenNumber);

  if (pending.length === 0) {
    return { added: 0, errors };
  }

  for (const stop of pending) {
    const index = findRouteInsertIndex(
      list,
      stop.street,
      stop.number
    );

    list.splice(index, 0, {
      kind: "new",
      clientId: stop.clientId,
      addressId: stop.addressId,
      street: stop.street,
      number: stop.number,
    });
  }

  let added = 0;

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const order = i + 1;

    if (item.kind === "existing") {
      if (item.currentOrder === order) {
        continue;
      }

      const { error } = await supabase
        .from("delivery_route_clients")
        .update({ delivery_order: order })
        .eq("id", item.id);

      if (error) {
        errors.push(error.message);
      }

      continue;
    }

    const { error } = await supabase
      .from("delivery_route_clients")
      .insert({
        route_id: routeId,
        client_id: item.clientId,
        address_id: item.addressId,
        delivery_order: order,
        active: true,
      });

    if (error) {
      errors.push(error.message);
    } else {
      added += 1;
    }
  }

  return { added, errors };
}
