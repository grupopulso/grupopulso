import ClientForm from "@/app/components/client-form";

import {
  requireModulePermission,
} from "@/app/lib/permissions";

export default async function NovoClientePage() {
  await requireModulePermission(
    "clients",
    "create"
  );

  return <ClientForm />;
}