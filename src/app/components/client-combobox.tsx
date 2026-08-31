"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, ChevronsUpDown } from "lucide-react";

type Option = {
  id: string;
  name: string;
};

export default function ClientCombobox({
  clients,
  value,
  onChange,
  placeholder = "Buscar cliente pelo nome...",
}: {
  clients: Option[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef =
    useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () =>
      clients.find(
        (client) => client.id === value
      ) ?? null,
    [clients, value]
  );

  const filtered = useMemo(() => {
    const term = query
      .trim()
      .toLocaleLowerCase("pt-BR");

    const list = !term
      ? clients
      : clients.filter((client) =>
          client.name
            .toLocaleLowerCase("pt-BR")
            .includes(term)
        );

    return list.slice(0, 50);
  }, [clients, query]);

  useEffect(() => {
    function onClickOutside(
      event: MouseEvent
    ) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      onClickOutside
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        onClickOutside
      );
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative mt-2"
    >
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          setQuery("");
        }}
        className="input flex w-full items-center justify-between text-left"
      >
        <span
          className={
            selected
              ? "text-slate-800"
              : "text-slate-400"
          }
        >
          {selected
            ? selected.name
            : "Selecione..."}
        </span>

        <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input
              autoFocus
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder={placeholder}
              className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#15704f]"
            />
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-slate-400">
                Nenhum cliente encontrado.
              </p>
            ) : (
              filtered.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => {
                    onChange(client.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                    client.id === value
                      ? "font-semibold text-[#15704f]"
                      : "text-slate-700"
                  }`}
                >
                  {client.name}

                  {client.id === value && (
                    <Check className="h-4 w-4" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
