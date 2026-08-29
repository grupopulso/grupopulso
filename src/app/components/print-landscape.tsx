/*
 * Força a orientação PAISAGEM só nas páginas que renderizam
 * este componente. O global (globals.css) é retrato; como este
 * <style> vem depois, no corpo da página, ele vence para a rota
 * atual. Usado nos relatórios de rota, que precisam de largura
 * para caber nomes + endereços.
 */
export default function PrintLandscape() {
  return (
    <style>
      {`@media print { @page { size: A4 landscape; margin: 10mm; } }`}
    </style>
  );
}
