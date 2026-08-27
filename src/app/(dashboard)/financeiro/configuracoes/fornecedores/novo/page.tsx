import SupplierForm from "@/app/components/supplier-form";

import {
  requireModulePermission,
} from "@/app/lib/permissions";

export default async function NovoFornecedorPage() {
  await requireModulePermission(
    "financial",
    "edit"
  );

  return <SupplierForm />;
}