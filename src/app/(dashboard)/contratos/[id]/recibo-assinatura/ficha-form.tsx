"use client";

import { useState } from "react";

import Link from "next/link";

import {
  FileSignature,
  Printer,
  RotateCcw,
} from "lucide-react";

export type FichaInitial = {
  isRenewal: boolean;
  start: string;
  end: string;
  client: string;
  document: string;
  address: string;
  city: string;
  neighborhood: string;
  phone: string;
  vendor: string;
  total: string;
  clientCode: string;
  subscriptionNumber: string;
  companyLegalName: string;
  companyCnpj: string;
};

type PaymentOption = "pix" | "boleto" | "cartao" | "direto";

const PAYMENT_OPTIONS: {
  value: PaymentOption;
  label: string;
}[] = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "BOLETO" },
  { value: "cartao", label: "CARTÃO" },
  { value: "direto", label: "DIRETO" },
];

/*
 * Ficha de assinatura/renovação para levar à casa do cliente.
 * Vem preenchida com o cadastro, mas tudo pode ser alterado aqui
 * antes de imprimir — nada é salvo no sistema (a renovação só é
 * registrada depois, quando o cliente confirmar). Forma de
 * pagamento, condição e observação ficam em branco pra preencher
 * na visita.
 */
export default function FichaForm({
  contractId,
  initial,
}: {
  contractId: string;
  initial: FichaInitial;
}) {
  const [values, setValues] = useState({
    ...initial,
    condition: "",
    notes: "",
  });

  const [payment, setPayment] =
    useState<PaymentOption | null>(null);

  function set(
    field: keyof typeof values,
    value: string | boolean
  ) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function reset() {
    setValues({
      ...initial,
      condition: "",
      notes: "",
    });
    setPayment(null);
  }

  const text = (
    field: keyof typeof values,
    label: string,
    options: { wide?: boolean; placeholder?: string } = {}
  ) => (
    <label
      className={`fld ${options.wide ? "fld-wide" : ""}`}
    >
      <span className="fld-label">{label}</span>
      <input
        type="text"
        value={String(values[field] ?? "")}
        onChange={(event) =>
          set(field, event.target.value)
        }
        placeholder={options.placeholder}
        className="fld-input"
      />
    </label>
  );

  const via = (
    <div className="via">
      <div className="head">
        <div className="brand">
          <p className="brand-name">O ESTAFETA</p>
          <p className="brand-legal">
            {initial.companyLegalName}
          </p>
          <p className="brand-sub">
            Av. Osvaldo Aranha, 975 — Sala 209 · Centro ·
            Veranópolis
          </p>
          <p className="brand-sub">
            www.oestafeta.com.br · @oestafeta · WhatsApp (54)
            9 9680-8359
          </p>
          <p className="brand-sub">
            Chave PIX: CNPJ {initial.companyCnpj}
          </p>
        </div>

        <div className="head-right">
          {(initial.clientCode ||
            initial.subscriptionNumber) && (
            <div className="codes">
              {initial.clientCode && (
                <span>Cód. cliente: {initial.clientCode}</span>
              )}
              {initial.subscriptionNumber && (
                <span>
                  Assinatura nº {initial.subscriptionNumber}
                </span>
              )}
            </div>
          )}

          <div className="tipo">
            <button
              type="button"
              className={`box ${!values.isRenewal ? "on" : ""}`}
              onClick={() => set("isRenewal", false)}
              aria-label="Marcar como nova"
            >
              {!values.isRenewal ? "X" : ""}
            </button>
            <span>NOVA</span>

            <button
              type="button"
              className={`box ${values.isRenewal ? "on" : ""}`}
              onClick={() => set("isRenewal", true)}
              aria-label="Marcar como renovação"
            >
              {values.isRenewal ? "X" : ""}
            </button>
            <span>RENOVAÇÃO</span>
          </div>
        </div>
      </div>

      <div className="grid">
        {text("start", "INÍCIO")}
        {text("end", "VENCIMENTO")}
        {text("client", "CLIENTE", { wide: true })}
        {text("document", "CPF/CNPJ", { wide: true })}
        {text("address", "ENDEREÇO")}
        {text("city", "CIDADE")}
        {text("neighborhood", "BAIRRO")}
        {text("phone", "FONE")}
        {text("vendor", "VENDEDOR", { wide: true })}
        {text("notes", "OBS", { wide: true })}
      </div>

      <div className="pgto">
        <div className="pgto-formas">
          <span className="pgto-title">
            FORMA DE PAGAMENTO
          </span>

          {PAYMENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="opt"
              onClick={() =>
                setPayment((current) =>
                  current === option.value
                    ? null
                    : option.value
                )
              }
            >
              <span
                className={`radio ${
                  payment === option.value ? "on" : ""
                }`}
              />
              {option.label}
            </button>
          ))}
        </div>

        <div className="pgto-cond">
          {text("condition", "CONDIÇÃO")}
          {text("total", "TOTAL R$")}
        </div>
      </div>

      <p className="footer">
        Sua assinatura vale prêmios semanais. Fique de olho na
        versão impressa!
      </p>
    </div>
  );

  return (
    <>
      <div className="controls">
        <p className="hint">
          Os campos podem ser alterados antes de imprimir — nada é
          salvo aqui. Forma de pagamento, condição e observação
          ficam em branco pra preencher na visita. Com a ficha
          preenchida, use <strong>Registrar renovação</strong> pra
          passar os dados pro contrato.
        </p>

        <div className="actions">
          <button
            type="button"
            onClick={reset}
            className="btn-secondary"
          >
            <RotateCcw className="h-4 w-4" />
            Desfazer alterações
          </button>

          <Link
            href={`/contratos/${contractId}/renovar`}
            className="btn-secondary"
          >
            <FileSignature className="h-4 w-4" />
            Registrar renovação
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="btn-primary"
          >
            <Printer className="h-4 w-4" />
            Gerar PDF / Imprimir
          </button>
        </div>
      </div>

      <div className="folha">
        {via}
        <div className="corte">
          — — — — — — — — — — — — — — — — — — — — — — — — — — — —
          — —
        </div>
        {via}
      </div>
    </>
  );
}
