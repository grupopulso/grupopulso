import ProductForm from "@/app/components/product-form";
import {
  requireModulePermission,
} from "@/app/lib/permissions";

export default async function NovoProdutoPage() {
 await requireModulePermission(
  "products",
  "create"
);
  return <ProductForm />;
}