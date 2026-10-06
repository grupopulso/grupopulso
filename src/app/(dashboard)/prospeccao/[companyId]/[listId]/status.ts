export const STATUS_OPTIONS = [
  { value: "none", label: "Sem contato" },
  { value: "contacted", label: "Contato feito" },
  { value: "closed", label: "Fechou o anúncio" },
  { value: "declined", label: "Não quer anunciar" },
] as const;

export const STATUS_ROW_CLASSES: Record<
  string,
  string
> = {
  none: "bg-white",
  contacted: "bg-amber-100",
  closed: "bg-emerald-100",
  declined: "bg-red-100",
};

export const STATUS_BADGE_CLASSES: Record<
  string,
  string
> = {
  none: "bg-slate-100 text-slate-500",
  contacted: "bg-amber-200 text-amber-800",
  closed: "bg-emerald-200 text-emerald-800",
  declined: "bg-red-200 text-red-800",
};

/*
 * Tipo do ponto (só na prospecção da Pottencializa, que tem telões
 * e TVs numa lista única). Valor vazio = não informado.
 */
export const KIND_OPTIONS = [
  { value: "telao", label: "Telão" },
  { value: "tv", label: "TV" },
] as const;

export const KIND_BADGE_CLASSES: Record<
  string,
  string
> = {
  telao: "bg-indigo-100 text-indigo-700",
  tv: "bg-sky-100 text-sky-700",
};

export function kindLabel(
  kind: string | null
) {
  return (
    KIND_OPTIONS.find(
      (option) => option.value === kind
    )?.label ?? "—"
  );
}

export function statusLabel(status: string) {
  return (
    STATUS_OPTIONS.find(
      (option) => option.value === status
    )?.label ?? status
  );
}
