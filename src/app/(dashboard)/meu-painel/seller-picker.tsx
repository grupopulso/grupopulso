"use client";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

type Seller = {
  id: string;
  name: string | null;
};

export default function SellerPicker({
  sellers,
  currentUserId,
  selectedId,
}: {
  sellers: Seller[];
  currentUserId: string;
  selectedId: string;
}) {
  const router = useRouter();

  const searchParams = useSearchParams();

  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
      <span className="text-xs font-medium text-slate-500">
        Acompanhar vendedor
      </span>

      <select
        value={selectedId}
        onChange={(event) => {
          const value = event.target.value;

          /*
           * Preserva o período (mes/ano/periodo) já
           * selecionado ao trocar de vendedor.
           */
          const query = new URLSearchParams(
            searchParams.toString()
          );

          if (value === currentUserId) {
            query.delete("vendedor");
          } else {
            query.set("vendedor", value);
          }

          const qs = query.toString();

          router.push(
            qs ? `/meu-painel?${qs}` : "/meu-painel"
          );
        }}
        className="bg-transparent text-sm font-semibold text-slate-800 outline-none"
      >
        <option value={currentUserId}>
          Eu
        </option>

        {sellers
          .filter(
            (seller) =>
              seller.id !== currentUserId
          )
          .map((seller) => (
            <option
              key={seller.id}
              value={seller.id}
            >
              {seller.name ??
                "Sem nome"}
            </option>
          ))}
      </select>
    </label>
  );
}
