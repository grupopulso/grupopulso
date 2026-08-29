import { notFound } from "next/navigation";

import ProductForm from "@/app/components/product-form";

import { createClient } from "@/app/lib/supabase/server";
import {
  requireCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditarProdutoPage({
  params,
}: PageProps) {
  const access =
    await requireModulePermission(
      "products",
      "edit"
    );

  const { id } = await params;

  const supabase =
    await createClient();

  const {
    data: product,
    error,
  } = await supabase
    .from("products")
    .select(`
      id,
      company_id,
      name,
      description,
      category,
      type,
      default_price,
      commission_percentage,
      billing_frequency,
      active
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !product) {
    notFound();
  }

  await requireCompanyAccess(
    product.company_id
  );

  let companiesQuery = supabase
    .from("companies")
    .select("id, name")
    .eq("active", true)
    .order("name");

  if (
    access.profile.role !== "admin"
  ) {
    companiesQuery = companiesQuery.in(
      "id",
      access.companyIds.length > 0
        ? access.companyIds
        : [
            "00000000-0000-0000-0000-000000000000",
          ]
    );
  }

  const { data: companies } =
    await companiesQuery;

  return (
    <ProductForm
      companies={companies ?? []}
      product={{
        id: product.id,
        companyId: product.company_id,
        name: product.name,
        description:
          product.description,
        category: product.category,
        type: product.type,
        defaultPrice:
          product.default_price === null
            ? null
            : Number(
                product.default_price
              ),
        commissionPercentage:
          product.commission_percentage ===
          null
            ? null
            : Number(
                product.commission_percentage
              ),
        billingFrequency:
          product.billing_frequency ??
          "one_time",
        active: product.active ?? true,
      }}
    />
  );
}
