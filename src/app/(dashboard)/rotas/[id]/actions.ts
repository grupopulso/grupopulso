"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/app/lib/supabase/server";

export async function deleteRoute(routeId: string) {
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

export async function removeSubscriber(
  routeId: string,
  relationId: string
) {
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