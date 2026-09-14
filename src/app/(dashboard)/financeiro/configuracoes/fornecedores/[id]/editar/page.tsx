import { notFound } from "next/navigation";

import SupplierForm from "@/app/components/supplier-form";

import { createAdminClient } from "@/app/lib/supabase/admin";
import {
  requireModulePermission,
} from "@/app/lib/permissions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarFornecedorPage({
  params,
}: PageProps) {
  await requireModulePermission(
    "financial",
    "edit"
  );

  const { id } = await params;

  /*
   * Via service role: a permissão já foi checada acima
   * (financial.edit). Evita bloqueio de RLS.
   */
  const supabase = createAdminClient();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select(`
      id,
      name,
      trade_name,
      cpf_cnpj,
      email,
      phone,
      whatsapp,
      notes,
      active
    `)
    .eq("id", id)
    .maybeSingle();

  if (!supplier) {
    notFound();
  }

  return <SupplierForm supplier={supplier} />;
}
