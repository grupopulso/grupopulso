export type ContractStatus =
  | "active"
  | "expiring"
  | "expired"
  | "cancelled";

/*
 * Janela (em dias) usada para considerar um contrato "a vencer".
 * Ajuste aqui se a regra de negócio mudar — é o único lugar que precisa
 * ser alterado.
 */
const DEFAULT_EXPIRING_WINDOW_DAYS = 30;

type ContractStatusInput = {
  status: string;
  start_date: string;
  end_date: string | null;
};

/**
 * Calcula o status real de um contrato/assinatura a partir de
 * `start_date`/`end_date`, em vez de confiar apenas no valor gravado em
 * `contracts.status`.
 *
 * `cancelled` continua sendo uma decisão manual (alguém cancelou o
 * contrato). Os demais estados (`active`, `expiring`, `expired`) são
 * sempre recalculados com base nas datas x hoje, então nunca ficam
 * desatualizados — não depende de nenhum job/rotina rodar para manter
 * o status correto.
 *
 * Essa é a mesma regra que já existia (e funcionava) isoladamente em
 * `contratos/[id]/page.tsx` (função `calculateContractStatus`) — só
 * centralizada aqui para não ficar duplicada/divergente entre telas.
 */
export function getContractStatus(
  contract: ContractStatusInput,
  expiringWithinDays: number = DEFAULT_EXPIRING_WINDOW_DAYS
): ContractStatus {
  if (contract.status === "cancelled") {
    return "cancelled";
  }

  const today = startOfDay(new Date());

  const start = new Date(
    `${contract.start_date}T12:00:00`
  );

  if (start > today) {
    return "active";
  }

  if (!contract.end_date) {
    return "active";
  }

  const end = new Date(
    `${contract.end_date}T12:00:00`
  );

  if (end < today) {
    return "expired";
  }

  const millisecondsPerDay =
    1000 * 60 * 60 * 24;

  const daysUntilEnd = Math.ceil(
    (end.getTime() - today.getTime()) /
      millisecondsPerDay
  );

  if (daysUntilEnd <= expiringWithinDays) {
    return "expiring";
  }

  return "active";
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

const STATUS_PRIORITY: ContractStatus[] = [
  "expired",
  "expiring",
  "active",
  "cancelled",
];

/**
 * Dado um conjunto de contratos (ex.: todos os contratos de um cliente
 * numa empresa), calcula qual status "manda" no resumo — o mesmo critério
 * que já existia em `getMainStatus` (vencido > a vencer > ativo >
 * cancelado), só que agora olhando o status real de cada contrato, não o
 * valor gravado.
 *
 * Retorna `null` quando não há nenhum contrato — nesse caso quem chama
 * decide o que mostrar (ex.: manter o status gravado em
 * `client_companies.status` como fallback, para clientes sem contrato
 * formal).
 */
export function getMostUrgentContractStatus(
  contracts: ContractStatusInput[],
  expiringWithinDays: number = DEFAULT_EXPIRING_WINDOW_DAYS
): ContractStatus | null {
  if (!contracts.length) {
    return null;
  }

  const statuses = contracts.map(
    (contract) =>
      getContractStatus(contract, expiringWithinDays)
  );

  return (
    STATUS_PRIORITY.find((status) =>
      statuses.includes(status)
    ) ?? null
  );
}

/**
 * Converte um valor de status gravado livremente no banco (ex.:
 * `client_companies.status`) para um dos 4 status conhecidos, com
 * fallback para "active" — mesmo comportamento que `getMainStatus` já
 * tinha para valores vazios/inesperados.
 */
export function normalizeStoredStatus(
  value: string
): ContractStatus {
  const known: ContractStatus[] = [
    "active",
    "expiring",
    "expired",
    "cancelled",
  ];

  return known.includes(value as ContractStatus)
    ? (value as ContractStatus)
    : "active";
}

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  active: "Ativo",
  expiring: "A vencer",
  expired: "Vencido",
  cancelled: "Cancelado",
};

export const CONTRACT_STATUS_STYLES: Record<ContractStatus, string> = {
  active: "bg-emerald-50 text-emerald-700",
  expiring: "bg-amber-50 text-amber-700",
  expired: "bg-red-50 text-red-700",
  cancelled: "bg-slate-100 text-slate-600",
};
