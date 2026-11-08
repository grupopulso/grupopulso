import { notFound } from "next/navigation";

import { createClient } from "@/app/lib/supabase/server";
import {
  requireCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

import PrintLandscape from "@/app/components/print-landscape";

import FichaForm from "./ficha-form";

type PageProps = {
  params: Promise<{ id: string }>;
};

function getFirst<T>(
  value: T | T[] | null | undefined
): T | null {
  if (!value) return null;
  return Array.isArray(value)
    ? value[0] ?? null
    : value;
}

function formatDate(value: string | null) {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function ReciboAssinaturaPage({
  params,
}: PageProps) {
  await requireModulePermission(
    "contracts",
    "view"
  );

  const { id } = await params;

  const supabase = await createClient();

  const { data: contract, error } =
    await supabase
      .from("contracts")
      .select(
        `
        id,
        company_id,
        start_date,
        end_date,
        value,
        billing_frequency,
        installments,
        first_due_date,
        notes,
        responsible_user_id,
        legacy_subscription_number,
        title,

        client:clients (
          id,
          name,
          legacy_code,
          cpf_cnpj,
          phone,
          whatsapp,

          client_addresses (
            street,
            number,
            complement,
            neighborhood,
            city,
            is_primary
          )
        ),

        company:companies (
          id,
          name,
          legal_name,
          cnpj
        ),

        payment_method:payment_methods (
          id,
          name
        )
      `
      )
      .eq("id", id)
      .maybeSingle();

  if (error || !contract) {
    notFound();
  }

  await requireCompanyAccess(
    contract.company_id
  );

  const client = getFirst(contract.client) as
    | {
        name: string | null;
        legacy_code: string | null;
        cpf_cnpj: string | null;
        phone: string | null;
        whatsapp: string | null;
        client_addresses:
          | {
              street: string | null;
              number: string | null;
              complement: string | null;
              neighborhood: string | null;
              city: string | null;
              is_primary: boolean | null;
            }[]
          | null;
      }
    | null;

  const company = getFirst(
    contract.company
  ) as
    | {
        name: string | null;
        legal_name: string | null;
        cnpj: string | null;
      }
    | null;

  const addresses =
    client?.client_addresses ?? [];

  const address =
    addresses.find(
      (item) => item.is_primary
    ) ??
    addresses[0] ??
    null;

  let vendorName = "";

  if (contract.responsible_user_id) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("name")
      .eq(
        "id",
        contract.responsible_user_id
      )
      .maybeSingle();

    vendorName = profile?.name ?? "";
  }

  /*
   * Se as notas mencionam renovação, marca RENOVAÇÃO;
   * senão, NOVA.
   */
  const isRenewal = /renova/i.test(
    contract.notes ?? ""
  );

  const enderecoLinha = [
    address?.street,
    address?.number,
    address?.complement,
  ]
    .filter(Boolean)
    .join(", ");

  /*
   * Nº da assinatura: o contrato renovado nem sempre herda o
   * campo — cai no "#000000" do título ou na nota do legado.
   */
  const subscriptionNumber =
    contract.legacy_subscription_number ||
    (contract.title ?? "").match(/#(\d+)/)?.[1] ||
    (contract.notes ?? "").match(
      /Assinatura legado:\s*(\d+)/
    )?.[1] ||
    "";

  return (
    <main className="recibo-page">
      <PrintLandscape />

      <style>{RECIBO_CSS}</style>

      <FichaForm
        contractId={contract.id}
        initial={{
          isRenewal,
          start: formatDate(contract.start_date),
          end: formatDate(contract.end_date),
          client: client?.name ?? "",
          document: client?.cpf_cnpj ?? "",
          address: enderecoLinha,
          city: address?.city ?? "",
          neighborhood: address?.neighborhood ?? "",
          phone: client?.phone || client?.whatsapp || "",
          vendor: vendorName,
          total: formatCurrency(
            Number(contract.value ?? 0)
          ),
          clientCode: client?.legacy_code ?? "",
          subscriptionNumber,
          companyLegalName:
            company?.legal_name ??
            "PULSO SOLUÇÕES EM COMUNICAÇÃO E CULTURA LTDA",
          companyCnpj:
            company?.cnpj ?? "59.549.786/0001-43",
        }}
      />
    </main>
  );
}

const RECIBO_CSS = `
.recibo-page {
  min-height: 100vh;
  background: #f1f5f9;
  padding: 24px;
}
.controls {
  max-width: 1000px;
  margin: 0 auto 12px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.hint { font-size: 13px; color: #475569; max-width: 560px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.btn-primary, .btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 18px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
}
.btn-primary { background: #15704f; color: #fff; }
.btn-primary:hover { background: #105c41; }
.btn-secondary { background: #fff; color: #334155; border: 1px solid #e2e8f0; }
.head-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.codes {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 10px;
  font-weight: 700;
}
.fld-input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: #fefce8;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  color: #0f172a;
  outline: none;
  padding: 0 2px;
}
.fld-input:focus { background: #fef9c3; }
.box, .opt { cursor: pointer; background: transparent; color: inherit; }
.folha {
  max-width: 1000px;
  margin: 0 auto;
  background: #fff;
  padding: 16px 20px;
}
.corte {
  text-align: center;
  color: #94a3b8;
  font-size: 10px;
  letter-spacing: 2px;
  margin: 14px 0;
}
.via {
  border: 1.5px solid #0f172a;
  padding: 12px 14px;
  font-family: Arial, Helvetica, sans-serif;
  color: #0f172a;
}
.head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1.5px solid #0f172a;
  padding-bottom: 8px;
}
.brand-name { font-size: 20px; font-weight: 800; letter-spacing: 1px; }
.brand-legal { font-size: 10px; font-weight: 700; margin-top: 2px; }
.brand-sub { font-size: 9px; color: #334155; margin-top: 1px; }
.tipo {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 6px;
  align-items: center;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}
.box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1.5px solid #0f172a;
  font-size: 11px;
  font-weight: 800;
}
.box.on { background: #e2e8f0; }
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 14px;
  margin-top: 8px;
}
.fld {
  display: flex;
  align-items: baseline;
  gap: 6px;
  border-bottom: 1px solid #64748b;
  padding: 3px 0;
  min-height: 20px;
}
.fld-wide { grid-column: 1 / -1; }
.fld-label {
  font-size: 9px;
  font-weight: 700;
  color: #334155;
  white-space: nowrap;
}
.fld-value { font-size: 12px; font-weight: 600; }
.pgto {
  margin-top: 10px;
  border-top: 1.5px solid #0f172a;
  padding-top: 8px;
}
.pgto-formas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  font-size: 10px;
  font-weight: 700;
}
.pgto-title { font-size: 10px; }
.opt { display: inline-flex; align-items: center; gap: 4px; }
.radio {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 1.5px solid #0f172a;
  border-radius: 50%;
}
.radio.on { background: #0f172a; }
.pgto-cond {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 6px;
}
.footer {
  margin-top: 8px;
  font-size: 9px;
  font-style: italic;
  color: #334155;
  text-align: center;
}

@media print {
  .recibo-page { background: #fff; padding: 0; }
  .controls { display: none; }
  .fld-input { background: transparent; }
  .folha { max-width: none; margin: 0; padding: 6mm; }
  .via { border-color: #000; }
}
`;
