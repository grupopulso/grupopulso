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
  const access =
    await requireModulePermission(
      "contracts",
      "create"
    );

  const params =
    await searchParams;

  const initialClientId =
    params.clientId ??
    "";

  const allowedCompanyIds =
    access.profile.role === "admin"
      ? null
      : access.companyIds;

  return (
    <ContractForm
      initialClientId={
        initialClientId
      }
      allowedCompanyIds={
        allowedCompanyIds
      }
    />
  );
}
