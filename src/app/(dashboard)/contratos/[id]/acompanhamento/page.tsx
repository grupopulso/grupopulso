import Link from "next/link";

import {
  notFound,
} from "next/navigation";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Newspaper,
  XCircle,
} from "lucide-react";

import {
  createAdminClient,
} from "@/app/lib/supabase/admin";

import {
  requireCompanyAccess,
  requireModulePermission,
} from "@/app/lib/permissions";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Publication = {
  id: string;
  editionId: string;
  sectionName: string | null;
  positionName: string | null;
  sizeDescription: string | null;
  amount: number;
  notes: string | null;
};

type EditionRef = {
  id: string;
  name: string;
  editionNumber: number | null;
  status: string;
  publicationDate: string | null;
};

/*
 * Acompanhamento do contrato de anúncio: o valor do contrato vira
 * um "crédito" que vai sendo consumido a cada inserção cadastrada
 * nas edições. Mostra quanto já foi usado, quanto falta e em quais
 * edições do período o anúncio entrou (ou ficou de fora — pra
 * pegar inserção esquecida).
 */
export default async function ContractTrackingPage({
  params,
}: PageProps) {
  await requireModulePermission(
    "contracts",
    "view"
  );

  const {
    id,
  } = await params;

  /*
   * Service role (mesmo padrão da tela do contrato): permissão de
   * módulo validada acima + escopo de empresa logo abaixo.
   */
  const adminDb =
    createAdminClient();

  const {
    data: contract,
  } = await adminDb
    .from("contracts")
    .select(`
      id,
      company_id,
      title,
      start_date,
      end_date,
      value,
      status,
      legacy_subscription_number,

      client:clients (
        id,
        name
      ),

      company:companies (
        id,
        name,
        slug
      ),

      product:products (
        id,
        name,
        type
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (!contract) {
    notFound();
  }

  await requireCompanyAccess(
    contract.company_id
  );

  const client =
    getFirst(contract.client);

  const company =
    getFirst(contract.company);

  const product =
    getFirst(contract.product);

  const isAdContract =
    company?.slug === "o-estafeta" &&
    product?.type !== "subscription" &&
    !contract.legacy_subscription_number;

  if (!isAdContract) {
    return (
      <main className="min-h-screen bg-[#f5f7f6] p-8">
        <div className="mx-auto max-w-4xl">
          <BackLink contractId={contract.id} />

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="font-semibold text-slate-900">
              Acompanhamento indisponível
            </p>

            <p className="mt-2 text-sm text-slate-500">
              O acompanhamento de inserções vale para contratos de
              anúncio do O Estafeta.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const today =
    toDateOnly(new Date());

  /*
   * =========================
   * INSERÇÕES DO CONTRATO
   * =========================
   */

  const {
    data: publicationRows,
  } = await adminDb
    .from(
      "contract_edition_publications"
    )
    .select(`
      id,
      edition_id,
      size_description,
      amount,
      notes,

      edition:newspaper_editions (
        id,
        name,
        edition_number,
        status,
        publication_date
      ),

      section:edition_sections (
        name
      ),

      position:edition_ad_positions (
        name
      )
    `)
    .eq("contract_id", contract.id)
    .eq("active", true);

  const publicationsByEdition =
    new Map<string, Publication[]>();

  const publishedEditions =
    new Map<string, EditionRef>();

  for (const row of publicationRows ?? []) {
    const edition =
      getFirst(row.edition);

    if (!edition) {
      continue;
    }

    publishedEditions.set(
      edition.id,
      {
        id: edition.id,
        name: edition.name,
        editionNumber:
          edition.edition_number,
        status: edition.status,
        publicationDate:
          edition.publication_date,
      }
    );

    const list =
      publicationsByEdition.get(
        edition.id
      ) ?? [];

    list.push({
      id: row.id,
      editionId: edition.id,
      sectionName:
        getFirst(row.section)?.name ??
        null,
      positionName:
        getFirst(row.position)?.name ??
        null,
      sizeDescription:
        row.size_description,
      amount: Number(row.amount ?? 0),
      notes: row.notes,
    });

    publicationsByEdition.set(
      edition.id,
      list
    );
  }

  /*
   * =========================
   * EDIÇÕES DO PERÍODO
   * =========================
   *
   * Todas as edições (não canceladas) da empresa entre o início
   * e o fim do contrato. Sem data de término: até a última
   * inserção ou hoje, o que for mais tarde.
   */

  const lastPublicationDate =
    [...publishedEditions.values()]
      .map(
        (edition) =>
          edition.publicationDate ?? ""
      )
      .sort()
      .at(-1) ?? "";

  const periodStart =
    contract.start_date ?? null;

  const periodEnd =
    contract.end_date ??
    (lastPublicationDate > today
      ? lastPublicationDate
      : today);

  let periodEditions: EditionRef[] = [];

  if (periodStart) {
    const {
      data: editionRows,
    } = await adminDb
      .from("newspaper_editions")
      .select(`
        id,
        name,
        edition_number,
        status,
        publication_date
      `)
      .eq(
        "company_id",
        contract.company_id
      )
      .neq("status", "cancelled")
      .gte(
        "publication_date",
        periodStart
      )
      .lte(
        "publication_date",
        periodEnd
      )
      .order("publication_date", {
        ascending: true,
      });

    periodEditions = (
      editionRows ?? []
    ).map((edition) => ({
      id: edition.id,
      name: edition.name,
      editionNumber:
        edition.edition_number,
      status: edition.status,
      publicationDate:
        edition.publication_date,
    }));
  }

  const periodEditionIds = new Set(
    periodEditions.map(
      (edition) => edition.id
    )
  );

  /*
   * Inserções em edições fora do período do contrato (ou em
   * edição cancelada) — aparecem à parte pra conferência.
   */
  const outsideEditions = [
    ...publishedEditions.values(),
  ]
    .filter(
      (edition) =>
        !periodEditionIds.has(edition.id)
    )
    .sort((a, b) =>
      (a.publicationDate ?? "").localeCompare(
        b.publicationDate ?? ""
      )
    );

  /*
   * =========================
   * NÚMEROS
   * =========================
   */

  const contractValue =
    Number(contract.value ?? 0);

  const allPublications = [
    ...publicationsByEdition.values(),
  ].flat();

  const usedAmount = roundMoney(
    allPublications.reduce(
      (total, publication) =>
        total + publication.amount,
      0
    )
  );

  const publishedAmount = roundMoney(
    allPublications.reduce(
      (total, publication) => {
        const edition =
          publishedEditions.get(
            publication.editionId
          );

        return edition?.publicationDate &&
          edition.publicationDate <= today
          ? total + publication.amount
          : total;
      },
      0
    )
  );

  const remaining = roundMoney(
    contractValue - usedAmount
  );

  const usedPercentage =
    contractValue > 0
      ? (usedAmount / contractValue) * 100
      : 0;

  const pastEditions =
    periodEditions.filter(
      (edition) =>
        edition.publicationDate &&
        edition.publicationDate <= today
    );

  const missingEditions =
    pastEditions.filter(
      (edition) =>
        !publicationsByEdition.has(
          edition.id
        )
    );

  const pastWithInsertion =
    pastEditions.length -
    missingEditions.length;

  const periodEnded =
    Boolean(contract.end_date) &&
    periodEnd < today;

  return (
    <main className="min-h-screen bg-[#f5f7f6] p-8">
      <div className="mx-auto max-w-5xl">
        <BackLink contractId={contract.id} />

        {/* CABEÇALHO */}

        <div className="mt-7 flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#15704f]">
            <Newspaper className="h-5 w-5" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Acompanhamento do contrato
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {client?.name ?? "Cliente"} ·{" "}
              {contract.title}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Período:{" "}
              {formatDate(periodStart)} até{" "}
              {contract.end_date
                ? formatDate(contract.end_date)
                : "sem término definido"}
            </p>
          </div>
        </div>

        {/* RESUMO */}

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Valor do contrato"
            value={formatCurrency(
              contractValue
            )}
          />

          <SummaryCard
            label="Lançado nas edições"
            value={formatCurrency(usedAmount)}
            hint={
              publishedAmount !== usedAmount
                ? `${formatCurrency(publishedAmount)} já publicado`
                : `${allPublications.length} ${
                    allPublications.length === 1
                      ? "inserção"
                      : "inserções"
                  }`
            }
          />

          <SummaryCard
            label="Crédito restante"
            value={formatCurrency(
              Math.max(remaining, 0)
            )}
            tone={
              remaining < 0
                ? "danger"
                : remaining > 0
                  ? "primary"
                  : "default"
            }
          />

          <SummaryCard
            label="Edições do período"
            value={
              pastEditions.length > 0
                ? `${pastWithInsertion} de ${pastEditions.length}`
                : "—"
            }
            hint={
              pastEditions.length > 0
                ? "já publicadas com o anúncio"
                : "nenhuma edição publicada ainda"
            }
            tone={
              missingEditions.length > 0
                ? "warning"
                : "default"
            }
          />
        </div>

        {/* PROGRESSO */}

        {contractValue > 0 ? (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-slate-500">
                Uso do crédito do contrato
              </span>

              <span className="font-semibold text-slate-800">
                {formatPercentage(
                  usedPercentage
                )}
              </span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${
                  usedPercentage > 100
                    ? "bg-red-500"
                    : "bg-[#15704f]"
                }`}
                style={{
                  width: `${Math.min(
                    usedPercentage,
                    100
                  )}%`,
                }}
              />
            </div>

            {remaining < 0 && (
              <Alert tone="danger">
                As inserções lançadas passam do valor do contrato em{" "}
                <strong>
                  {formatCurrency(-remaining)}
                </strong>
                . Confira se algum anúncio foi lançado com valor
                errado ou em duplicidade.
              </Alert>
            )}

            {periodEnded && remaining > 0 && (
              <Alert tone="warning">
                O período do contrato já terminou e ainda sobram{" "}
                <strong>
                  {formatCurrency(remaining)}
                </strong>{" "}
                de crédito sem inserção.
              </Alert>
            )}

            {missingEditions.length > 0 && (
              <Alert tone="warning">
                {missingEditions.length === 1
                  ? "1 edição já publicada no período ficou sem anúncio deste contrato"
                  : `${missingEditions.length} edições já publicadas no período ficaram sem anúncio deste contrato`}
                {" "}— veja abaixo, marcadas em vermelho. Se o
                anúncio saiu, falta cadastrar na edição.
              </Alert>
            )}
          </section>
        ) : (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Este contrato não tem valor (cortesia/permuta), então
            não há crédito a controlar — abaixo aparecem só as
            inserções.
          </section>
        )}

        {/* LINHA DO TEMPO */}

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-[#15704f]" />

              <h2 className="font-semibold text-slate-900">
                Edições do período
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Todas as edições entre o início e o fim do contrato,
              com e sem o anúncio.
            </p>
          </div>

          {!periodStart ? (
            <p className="px-6 py-10 text-center text-sm text-slate-400">
              O contrato está sem data de início — não dá para
              montar o período.
            </p>
          ) : periodEditions.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-400">
              Nenhuma edição cadastrada dentro do período do
              contrato.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {periodEditions.map((edition) => (
                <EditionRow
                  key={edition.id}
                  edition={edition}
                  publications={
                    publicationsByEdition.get(
                      edition.id
                    ) ?? []
                  }
                  today={today}
                />
              ))}
            </ul>
          )}
        </section>

        {/* FORA DO PERÍODO */}

        {outsideEditions.length > 0 && (
          <section className="mt-6 overflow-hidden rounded-2xl border border-amber-200 bg-white">
            <div className="border-b border-amber-100 bg-amber-50/60 px-6 py-5">
              <h2 className="font-semibold text-slate-900">
                Inserções fora do período
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Anúncios deste contrato em edições antes do início
                ou depois do término. Também contam no crédito.
              </p>
            </div>

            <ul className="divide-y divide-slate-100">
              {outsideEditions.map((edition) => (
                <EditionRow
                  key={edition.id}
                  edition={edition}
                  publications={
                    publicationsByEdition.get(
                      edition.id
                    ) ?? []
                  }
                  today={today}
                />
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

/*
 * =========================
 * COMPONENTES
 * =========================
 */

function BackLink({
  contractId,
}: {
  contractId: string;
}) {
  return (
    <Link
      href={`/contratos/${contractId}`}
      className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
    >
      <ArrowLeft className="h-4 w-4" />
      Voltar para o contrato
    </Link>
  );
}

function EditionRow({
  edition,
  publications,
  today,
}: {
  edition: EditionRef;
  publications: Publication[];
  today: string;
}) {
  const total = publications.reduce(
    (sum, publication) =>
      sum + publication.amount,
    0
  );

  const isPast =
    Boolean(edition.publicationDate) &&
    (edition.publicationDate ?? "") <= today;

  const hasPublication =
    publications.length > 0;

  const state = hasPublication
    ? isPast
      ? "published"
      : "scheduled"
    : isPast
      ? "missing"
      : "upcoming";

  const stateStyles = {
    published: {
      icon: CheckCircle2,
      color: "text-emerald-600",
      label: "Anúncio publicado",
      row: "",
    },
    scheduled: {
      icon: Clock3,
      color: "text-blue-600",
      label: "Anúncio programado",
      row: "",
    },
    missing: {
      icon: XCircle,
      color: "text-red-500",
      label: "Sem anúncio",
      row: "bg-red-50/40",
    },
    upcoming: {
      icon: CircleDashed,
      color: "text-slate-300",
      label: "Ainda sem anúncio",
      row: "",
    },
  }[state];

  const Icon = stateStyles.icon;

  return (
    <li
      className={`flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-start sm:justify-between ${stateStyles.row}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon
          className={`mt-0.5 h-5 w-5 shrink-0 ${stateStyles.color}`}
        />

        <div className="min-w-0">
          <Link
            href={`/edicoes/${edition.id}`}
            className="text-sm font-semibold text-slate-900 hover:text-[#15704f]"
          >
            {edition.name}
            {edition.editionNumber
              ? ` · Nº ${edition.editionNumber}`
              : ""}
          </Link>

          <p className="mt-0.5 text-xs text-slate-500">
            {formatDate(edition.publicationDate)} ·{" "}
            <span className={stateStyles.color}>
              {stateStyles.label}
            </span>
            {edition.status === "cancelled" &&
              " · edição cancelada"}
          </p>

          {publications.map((publication) => (
            <p
              key={publication.id}
              className="mt-1 text-xs text-slate-600"
            >
              {[
                publication.sectionName ??
                  "Geral",
                publication.positionName,
                publication.sizeDescription,
              ]
                .filter(Boolean)
                .join(" · ")}{" "}
              —{" "}
              <span className="font-medium text-slate-800">
                {formatCurrency(
                  publication.amount
                )}
              </span>
            </p>
          ))}
        </div>
      </div>

      <div className="shrink-0 text-right">
        {hasPublication ? (
          <p className="text-sm font-semibold text-slate-900">
            {formatCurrency(total)}
          </p>
        ) : state === "missing" ? (
          <Link
            href={`/edicoes/${edition.id}`}
            className="text-xs font-semibold text-[#15704f] hover:underline"
          >
            Abrir edição
          </Link>
        ) : null}
      </div>
    </li>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?:
    | "default"
    | "primary"
    | "warning"
    | "danger";
}) {
  const valueColor = {
    default: "text-slate-900",
    primary: "text-[#15704f]",
    warning: "text-amber-700",
    danger: "text-red-600",
  }[tone];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p
        className={`mt-2 text-lg font-semibold ${valueColor}`}
      >
        {value}
      </p>

      {hint && (
        <p className="mt-1 text-xs text-slate-400">
          {hint}
        </p>
      )}
    </div>
  );
}

function Alert({
  tone,
  children,
}: {
  tone: "warning" | "danger";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
        tone === "danger"
          ? "bg-red-50 text-red-700"
          : "bg-amber-50 text-amber-800"
      }`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

      <p>{children}</p>
    </div>
  );
}

/*
 * =========================
 * HELPERS
 * =========================
 */

function getFirst<T>(
  value: T | T[] | null | undefined
): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value)
    ? value[0] ?? null
    : value;
}

function toDateOnly(date: Date) {
  // Data de hoje no fuso de Brasília (o servidor roda em UTC).
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function formatDate(date: string | null) {
  if (!date) {
    return "—";
  }

  const parsed = new Date(
    `${date.slice(0, 10)}T12:00:00`
  );

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "pt-BR"
  ).format(parsed);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatPercentage(value: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function roundMoney(value: number) {
  return (
    Math.round(
      (value + Number.EPSILON) * 100
    ) / 100
  );
}
