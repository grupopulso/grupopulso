"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/app/lib/supabase/server";
import {
  requireCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";
import {
  addStopsInGeographicOrder,
} from "@/app/lib/delivery-route";

async function getRouteCompanyId(
  routeId: string
) {
  const supabase = await createClient();

  const { data: route } = await supabase
    .from("delivery_routes")
    .select("company_id")
    .eq("id", routeId)
    .maybeSingle();

  return route?.company_id ?? null;
}

export async function deleteRoute(routeId: string) {
  await requireModulePermission(
    "routes",
    "delete"
  );

  const companyId =
    await getRouteCompanyId(routeId);

  if (!companyId) {
    return {
      success: false,
      message: "Rota não encontrada.",
    };
  }

  await requireCompanyAccess(companyId);

  const supabase = await createClient();

  const { error } = await supabase
    .from("delivery_routes")
    .delete()
    .eq("id", routeId);

  if (error) {
    console.error(
      "Erro ao excluir rota:",
      error
    );

    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath("/rotas");

  redirect("/rotas");
}

export async function addSubscribersToRoute(
  routeId: string,
  items: {
    clientId: string;
    addressId: string | null;
  }[]
) {
  await requireModulePermission(
    "routes",
    "edit"
  );

  const companyId =
    await getRouteCompanyId(routeId);

  if (!companyId) {
    return {
      success: false,
      message: "Rota não encontrada.",
    };
  }

  await requireCompanyAccess(companyId);

  const cleanItems = items.filter(
    (item) => item.clientId
  );

  if (cleanItems.length === 0) {
    return {
      success: false,
      message: "Selecione ao menos um assinante.",
    };
  }

  const supabase = await createClient();

  const addressIds = cleanItems
    .map((item) => item.addressId)
    .filter(Boolean) as string[];

  const { data: addresses } =
    addressIds.length > 0
      ? await supabase
          .from("client_addresses")
          .select("id, street, number")
          .in("id", addressIds)
      : { data: [] as {
          id: string;
          street: string | null;
          number: string | null;
        }[] };

  const addressById = new Map(
    (addresses ?? []).map((address) => [
      address.id,
      address,
    ])
  );

  const { added, errors } =
    await addStopsInGeographicOrder(
      supabase,
      routeId,
      cleanItems.map((item) => {
        const address = item.addressId
          ? addressById.get(item.addressId)
          : null;

        return {
          clientId: item.clientId,
          addressId: item.addressId,
          street: address?.street ?? null,
          number: address?.number ?? null,
        };
      })
    );

  revalidatePath(`/rotas/${routeId}`);
  revalidatePath(
    `/rotas/${routeId}/assinantes`
  );
  revalidatePath(
    `/rotas/${routeId}/imprimir`
  );

  if (errors.length > 0 && added === 0) {
    return {
      success: false,
      message: errors[0],
    };
  }

  return {
    success: true,
    added,
  };
}

export async function removeSubscriber(
  routeId: string,
  relationId: string
) {
  await requireModulePermission(
    "routes",
    "edit"
  );

  const companyId =
    await getRouteCompanyId(routeId);

  if (!companyId) {
    return {
      success: false,
      message: "Rota não encontrada.",
    };
  }

  await requireCompanyAccess(companyId);

  const supabase = await createClient();

  const { error } = await supabase
    .from("delivery_route_clients")
    .delete()
    .eq("id", relationId)
    .eq("route_id", routeId);

  if (error) {
    console.error(
      "Erro ao remover assinante:",
      error
    );

    return {
      success: false,
      message: error.message,
    };
  }

  await normalizeRouteOrder(routeId);

  revalidatePath(
    `/rotas/${routeId}`
  );

  return {
    success: true,
  };
}

export async function moveSubscriber(
  routeId: string,
  relationId: string,
  direction: "up" | "down"
) {
  await requireModulePermission(
    "routes",
    "edit"
  );

  const companyId =
    await getRouteCompanyId(routeId);

  if (!companyId) {
    return {
      success: false,
    };
  }

  await requireCompanyAccess(companyId);

  const supabase = await createClient();

  const { data: relations, error } =
    await supabase
      .from("delivery_route_clients")
      .select(`
        id,
        delivery_order
      `)
      .eq("route_id", routeId)
      .eq("active", true)
      .order("delivery_order", {
        ascending: true,
      });

  if (
    error ||
    !relations?.length
  ) {
    return {
      success: false,
    };
  }

  const index =
    relations.findIndex(
      (item) =>
        item.id === relationId
    );

  if (index < 0) {
    return {
      success: false,
    };
  }

  const targetIndex =
    direction === "up"
      ? index - 1
      : index + 1;

  if (
    targetIndex < 0 ||
    targetIndex >=
      relations.length
  ) {
    return {
      success: true,
    };
  }

  const current =
    relations[index];

  const target =
    relations[targetIndex];

  const currentOrder =
    current.delivery_order ??
    index + 1;

  const targetOrder =
    target.delivery_order ??
    targetIndex + 1;

  const { error: firstError } =
    await supabase
      .from(
        "delivery_route_clients"
      )
      .update({
        delivery_order:
          targetOrder,
      })
      .eq(
        "id",
        current.id
      );

  if (firstError) {
    return {
      success: false,
    };
  }

  const { error: secondError } =
    await supabase
      .from(
        "delivery_route_clients"
      )
      .update({
        delivery_order:
          currentOrder,
      })
      .eq(
        "id",
        target.id
      );

  if (secondError) {
    return {
      success: false,
    };
  }

  revalidatePath(
    `/rotas/${routeId}`
  );

  return {
    success: true,
  };
}

export async function updateSubscriberNotes(
  routeId: string,
  relationId: string,
  notes: string
) {
  await requireModulePermission(
    "routes",
    "edit"
  );

  const companyId =
    await getRouteCompanyId(routeId);

  if (!companyId) {
    return {
      success: false,
      message: "Rota não encontrada.",
    };
  }

  await requireCompanyAccess(companyId);

  const supabase = await createClient();

  const { error } = await supabase
    .from("delivery_route_clients")
    .update({
      notes:
        notes.trim() ||
        null,
    })
    .eq("id", relationId)
    .eq("route_id", routeId);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  revalidatePath(
    `/rotas/${routeId}`
  );

  return {
    success: true,
  };
}

async function normalizeRouteOrder(
  routeId: string
) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("delivery_route_clients")
    .select(`
      id,
      delivery_order
    `)
    .eq("route_id", routeId)
    .eq("active", true)
    .order("delivery_order", {
      ascending: true,
    });

  if (!data) {
    return;
  }

  for (
    let index = 0;
    index < data.length;
    index++
  ) {
    const expected =
      index + 1;

    if (
      data[index]
        .delivery_order !==
      expected
    ) {
      await supabase
        .from(
          "delivery_route_clients"
        )
        .update({
          delivery_order:
            expected,
        })
        .eq(
          "id",
          data[index].id
        );
    }
  }
}