/*
 * Em produção o app responde tanto em gpulso.com.br quanto em
 * www.gpulso.com.br. Sem um domínio de cookie compartilhado, o
 * login feito em um host não vale no outro (o cookie de sessão
 * fica preso ao host exato) — e a navegação pós-login cai de
 * volta na tela de login.
 *
 * Fixando o domínio do cookie em ".gpulso.com.br" quando o host
 * pertence a esse domínio, a sessão passa a valer para o apex e
 * para qualquer subdomínio. localhost e *.vercel.app não são
 * afetados (retornam undefined = comportamento padrão).
 */
export function cookieDomainForHost(
  host: string | null | undefined
): string | undefined {
  if (!host) return undefined;

  const hostname = host
    .split(":")[0]
    .trim()
    .toLowerCase();

  if (
    hostname === "gpulso.com.br" ||
    hostname.endsWith(".gpulso.com.br")
  ) {
    return ".gpulso.com.br";
  }

  return undefined;
}
