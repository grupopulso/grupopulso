import { notFound } from "next/navigation";

import { createClient } from "@/app/lib/supabase/server";
import {
  requireCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

import PrintButton from "../recibo/print-button";
import PrintLandscape from "@/app/components/print-landscape";

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

const BILLING_LABELS: Record<string, string> =
  {
    one_time: "único",
    monthly: "mensal",
    quarterly: "trimestral",
    semiannual: "semestral",
    annual: "anual",
    custom: "personalizado",
  };

/*
 * Marca a forma de pagamento a partir do nome / código.
 */
function paymentFlags(name: string) {
  const n = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return {
    pix: n.includes("pix"),
    boleto:
      n.includes("boleto") ||
      n.includes("bancario"),
    cartao:
      n.includes("cartao") ||
      n.includes("credito") ||
      n.includes("debito"),
    direto:
      n.includes("direto") ||
      n.includes("dinheiro") ||
      n.includes("especie"),
  };
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

        client:clients (
          id,
          name,
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

  const paymentMethod = getFirst(
    contract.payment_method
  ) as { name: string | null } | null;

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

  const flags = paymentFlags(
    paymentMethod?.name ?? ""
  );

  const enderecoLinha = [
    address?.street,
    address?.number,
    address?.complement,
  ]
    .filter(Boolean)
    .join(", ");

  const conditionLabel = `${
    contract.installments ?? 1
  }x · ${
    BILLING_LABELS[
      contract.billing_frequency
    ] ?? contract.billing_frequency
  }`;

  const via = (
    <div className="via">
      {/* CABEÇALHO */}
      <div className="head">
        <div className="brand">
          <p className="brand-name">
            O ESTAFETA
          </p>
          <p className="brand-legal">
            {company?.legal_name ??
              "PULSO SOLUÇÕES EM COMUNICAÇÃO E CULTURA LTDA"}
          </p>
          <p className="brand-sub">
            Av. Osvaldo Aranha, 975 — Sala 209 · Centro · Veranópolis
          </p>
          <p className="brand-sub">
            www.oestafeta.com.br · @oestafeta ·
            WhatsApp (54) 9 9680-8359
          </p>
          <p className="brand-sub">
            Chave PIX: CNPJ{" "}
            {company?.cnpj ??
              "59.549.786/0001-43"}
          </p>
        </div>

        <div className="tipo">
          <span
            className={`box ${
              !isRenewal ? "on" : ""
            }`}
          >
            {!isRenewal ? "X" : ""}
          </span>
          <span>NOVA</span>

          <span
            className={`box ${
              isRenewal ? "on" : ""
            }`}
          >
            {isRenewal ? "X" : ""}
          </span>
          <span>RENOVAÇÃO</span>
        </div>
      </div>

      {/* CORPO */}
      <div className="grid">
        <Field
          label="INÍCIO"
          value={formatDate(
            contract.start_date
          )}
        />
        <Field
          label="VENCIMENTO"
          value={formatDate(
            contract.end_date
          )}
        />

        <Field
          label="CLIENTE"
          value={client?.name ?? ""}
          wide
        />

        <Field
          label="CPF/CNPJ"
          value={client?.cpf_cnpj ?? ""}
          wide
        />

        <Field
          label="ENDEREÇO"
          value={enderecoLinha}
        />
        <Field
          label="CIDADE"
          value={address?.city ?? ""}
        />

        <Field
          label="BAIRRO"
          value={
            address?.neighborhood ?? ""
          }
        />
        <Field
          label="FONE"
          value={
            client?.phone ||
            client?.whatsapp ||
            ""
          }
        />

        <Field
          label="VENDEDOR"
          value={vendorName}
          wide
        />

        <Field
          label="OBS"
          value={contract.notes ?? ""}
          wide
        />
      </div>

      {/* PAGAMENTO */}
      <div className="pgto">
        <div className="pgto-formas">
          <span className="pgto-title">
            FORMA DE PAGAMENTO
          </span>

          <span className="opt">
            <span
              className={`radio ${
                flags.pix ? "on" : ""
              }`}
            />
            PIX
          </span>
          <span className="opt">
            <span
              className={`radio ${
                flags.boleto ? "on" : ""
              }`}
            />
            BOLETO
          </span>
          <span className="opt">
            <span
              className={`radio ${
                flags.cartao ? "on" : ""
              }`}
            />
            CARTÃO
          </span>
          <span className="opt">
            <span
              className={`radio ${
                flags.direto ? "on" : ""
              }`}
            />
            DIRETO
          </span>
        </div>

        <div className="pgto-cond">
          <Field
            label="CONDIÇÃO"
            value={conditionLabel}
          />
          <Field
            label="TOTAL R$"
            value={formatCurrency(
              Number(contract.value ?? 0)
            )}
          />
        </div>
      </div>

      <p className="footer">
        Sua assinatura vale prêmios semanais. Fique de olho na versão impressa!
        {contract.legacy_subscription_number
          ? ` · Assinatura nº ${contract.legacy_subscription_number}`
          : ""}
      </p>
    </div>
  );

  return (
    <main className="recibo-page">
      <PrintLandscape />

      <style>{RECIBO_CSS}</style>

      <div className="controls">
        <PrintButton />
      </div>

      <div className="folha">
        {via}
        <div className="corte">
          — — — — — — — — — — — — — — — — — — — — — — — — — — — — — —
        </div>
        {via}
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`fld ${
        wide ? "fld-wide" : ""
      }`}
    >
      <span className="fld-label">
        {label}
      </span>
      <span className="fld-value">
        {value}
      </span>
    </div>
  );
}

const RECIBO_CSS = `
.recibo-page {
  min-height: 100vh;
  background: #f1f5f9;
  padding: 24px;
}
.controls { max-width: 1000px; margin: 0 auto 12px; }
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
  .folha { max-width: none; margin: 0; padding: 6mm; }
  .via { border-color: #000; }
}
`;
