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

export function statusLabel(status: string) {
  return (
    STATUS_OPTIONS.find(
      (option) => option.value === status
    )?.label ?? status
  );
}
