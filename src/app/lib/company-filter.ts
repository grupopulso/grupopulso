import {
  cookies,
} from "next/headers";

import {
  requireAuthenticatedUser,
} from "@/app/lib/permissions";

export async function getSelectedCompanyId() {
  const access =
    await requireAuthenticatedUser();

  const cookieStore =
    await cookies();

  const selected =
    cookieStore.get(
      "pulso_company_id"
    )?.value ?? "all";

  if (
    selected === "all"
  ) {
    return null;
  }

  if (
    access.profile.role ===
    "admin"
  ) {
    return selected;
  }

  if (
    !access.companyIds.includes(
      selected
    )
  ) {
    return null;
  }

  return selected;
}