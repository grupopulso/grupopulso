import ContractForm from "@/app/components/contract-form";

import {
  requireModulePermission,
} from "@/app/lib/permissions";

type NovoContratoPageProps = {
  searchParams: Promise<{
    clientId?: string;
  }>;
};

export default async function NovoContratoPage({
  searchParams,
}: NovoContratoPageProps) {
  await requireModulePermission(
    "contracts",
    "create"
  );

  const params =
    await searchParams;

  const initialClientId =
    params.clientId ??
    "";

  return (
    <ContractForm
      initialClientId={
        initialClientId
      }
    />
  );
}