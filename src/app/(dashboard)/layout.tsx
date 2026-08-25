import { cookies } from "next/headers";

import AppShell from "@/app/components/app-shell";
import { CompanyProvider } from "@/app/components/company-provider";

import { createClient } from "@/app/lib/supabase/server";

import {
  requireAuthenticatedUser,
} from "@/app/lib/permissions";

type Company = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access =
    await requireAuthenticatedUser();

  const supabase =
    await createClient();

  const user =
    access.user;

  let companies: Company[] =
    [];

  if (
    access.profile.role ===
    "admin"
  ) {
    const {
      data,
      error,
    } = await supabase
      .from("companies")
      .select(`
        id,
        name,
        slug,
        color
      `)
      .eq("active", true)
      .order("name");

    if (error) {
      console.error(
        "Erro ao carregar empresas:",
        JSON.stringify(
          error,
          null,
          2
        )
      );
    }

    companies =
      (data ?? []) as Company[];
  } else {
    const {
      data: relations,
      error,
    } = await supabase
      .from("user_companies")
      .select(`
        company:companies (
          id,
          name,
          slug,
          color
        )
      `)
      .eq(
        "user_id",
        user.id
      );

    if (error) {
      console.error(
        "Erro ao carregar empresas do usuário:",
        JSON.stringify(
          error,
          null,
          2
        )
      );
    }

    companies =
      (
        relations?.flatMap(
          (item) =>
            item.company ??
            []
        ) ?? []
      ) as Company[];
  }

  const cookieStore =
    await cookies();

  let selectedCompanyId =
    cookieStore.get(
      "pulso_company_id"
    )?.value ?? "all";

  const userHasCompany =
    companies.some(
      (company) =>
        company.id ===
        selectedCompanyId
    );

  if (
    selectedCompanyId !==
      "all" &&
    !userHasCompany
  ) {
    selectedCompanyId =
      "all";
  }

  return (
    <CompanyProvider
      companies={
        companies
      }
      initialCompanyId={
        selectedCompanyId
      }
    >
      <AppShell
        user={{
          fullName:
            access.profile.name ??
            user.email ??
            "Usuário",

          role:
            access.profile.role,
        }}
        companies={
          companies
        }
        permissions={
          access.permissions
        }
      >
        {children}
      </AppShell>
    </CompanyProvider>
  );
}