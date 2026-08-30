import { notFound } from "next/navigation";

import { createClient } from "@/app/lib/supabase/server";
import { requireEstafetaAccess } from "@/app/lib/estafeta-access";

import EditEditionForm from "./edit-edition-form";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditarEdicaoPage({
  params,
}: PageProps) {
  const access =
    await requireEstafetaAccess();

  const { id } = await params;

  const supabase = await createClient();

  const { data: edition } = await supabase
    .from("newspaper_editions")
    .select(
      "id, company_id, name, edition_number, publication_date, status, notes"
    )
    .eq("id", id)
    .maybeSingle();

  if (
    !edition ||
    edition.company_id !==
      access.estafetaCompany.id
  ) {
    notFound();
  }

  if (edition.status === "cancelled") {
    notFound();
  }

  return (
    <EditEditionForm
      edition={{
        id: edition.id,
        name: edition.name ?? "",
        editionNumber:
          edition.edition_number ?? "",
        publicationDate:
          edition.publication_date ?? "",
        notes: edition.notes ?? "",
      }}
    />
  );
}
