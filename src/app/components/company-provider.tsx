"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

type Company = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
};

type CompanyContextType = {
  companies: Company[];
  selectedCompanyId: string;
  selectedCompany: Company | null;

  setSelectedCompanyId: (
    companyId: string
  ) => void;

  selectCompany: (
    companyId: string
  ) => void;
};

const CompanyContext =
  createContext<
    CompanyContextType | undefined
  >(undefined);

export function CompanyProvider({
  children,
  companies,
  initialCompanyId,
}: {
  children: React.ReactNode;
  companies: Company[];
  initialCompanyId: string;
}) {
  const router =
    useRouter();

  const [
    selectedCompanyId,
    setSelectedCompanyIdState,
  ] = useState(
    initialCompanyId
  );

  const selectedCompany =
    useMemo(() => {
      if (
        selectedCompanyId ===
        "all"
      ) {
        return null;
      }

      return (
        companies.find(
          (company) =>
            company.id ===
            selectedCompanyId
        ) ?? null
      );
    }, [
      companies,
      selectedCompanyId,
    ]);

  function selectCompany(
    companyId: string
  ) {
    const valid =
      companyId === "all" ||
      companies.some(
        (company) =>
          company.id ===
          companyId
      );

    const nextCompanyId =
      valid
        ? companyId
        : "all";

    setSelectedCompanyIdState(
      nextCompanyId
    );

    document.cookie =
      `pulso_company_id=${nextCompanyId}; path=/; max-age=31536000; SameSite=Lax`;

    router.refresh();
  }

  function setSelectedCompanyId(
    companyId: string
  ) {
    selectCompany(
      companyId
    );
  }

  return (
    <CompanyContext.Provider
      value={{
        companies,
        selectedCompanyId,
        selectedCompany,
        setSelectedCompanyId,
        selectCompany,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context =
    useContext(
      CompanyContext
    );

  if (!context) {
    throw new Error(
      "useCompany deve ser usado dentro de CompanyProvider."
    );
  }

  return context;
}