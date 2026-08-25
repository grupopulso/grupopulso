import {
  notFound,
} from "next/navigation";

import {
  createClient,
} from "@/app/lib/supabase/server";

import {
  requireModulePermission,
} from "@/app/lib/permissions";

import EditContractForm from "./edit-contract-form";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditContractPage({
  params,
}: PageProps) {
  await requireModulePermission(
    "contracts",
    "edit"
  );

  const {
    id,
  } = await params;

  const supabase =
    await createClient();

  const [
    contractResult,
    contractTvsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "contracts"
        )
        .select(`
          id,
          client_id,
          company_id,
          product_id,
          title,
          start_date,
          end_date,
          value,
          billing_frequency,
          auto_renew,
          payment_method_id,
          installments,
          first_due_date,
          notes
        `)
        .eq(
          "id",
          id
        )
        .maybeSingle(),

      supabase
        .from(
          "contract_tvs"
        )
        .select(`
          tv_id
        `)
        .eq(
          "contract_id",
          id
        ),
    ]);

  const {
    data: contract,
    error,
  } =
    contractResult;

  if (
    error ||
    !contract
  ) {
    notFound();
  }

  if (
    contractTvsResult.error
  ) {
    console.error(
      "Erro ao carregar TVs vinculadas:",
      contractTvsResult.error
    );
  }

  const initialTvIds =
    (
      contractTvsResult.data ??
      []
    ).map(
      (item) =>
        item.tv_id
    );

  return (
    <EditContractForm
      contract={{
        id:
          contract.id,

        clientId:
          contract.client_id,

        companyId:
          contract.company_id,

        productId:
          contract.product_id,

        title:
          contract.title,

        startDate:
          contract.start_date,

        endDate:
          contract.end_date,

        value:
          Number(
            contract.value
          ),

        billingFrequency:
          contract.billing_frequency ??
          "custom",

        autoRenew:
          contract.auto_renew,

        paymentMethodId:
          contract.payment_method_id ??
          "",

        installments:
          contract.installments ??
          1,

        firstDueDate:
          contract.first_due_date ??
          contract.start_date,

        notes:
          contract.notes,

        tvIds:
          initialTvIds,
      }}
    />
  );
}