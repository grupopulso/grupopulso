import {
  requireModulePermission,
} from "@/app/lib/permissions";

import NewTvForm from "./new-tv-form";

export default async function NovaTvPage() {
  await requireModulePermission(
    "settings",
    "create"
  );

  return (
    <NewTvForm />
  );
}