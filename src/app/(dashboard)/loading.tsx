/*
 * Esqueleto exibido na hora em que o usuário clica em outra tela,
 * enquanto o servidor monta a página. Sem isto a navegação ficava
 * "parada" (nada mudava na tela) até a página inteira carregar.
 * O menu lateral (layout) continua visível e clicável.
 */
export default function DashboardLoading() {
  return (
    <main
      className="min-h-screen bg-[#f5f7f6] p-8"
      aria-busy="true"
      aria-label="Carregando"
    >
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-slate-200" />

          <div className="space-y-2">
            <div className="h-6 w-56 rounded-lg bg-slate-200" />
            <div className="h-4 w-80 rounded-lg bg-slate-200/70" />
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 rounded-2xl border border-slate-200 bg-white"
            />
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="h-5 w-48 rounded-lg bg-slate-200" />

          <div className="mt-6 space-y-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-10 rounded-lg bg-slate-100"
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
