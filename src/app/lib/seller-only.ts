/*
 * "Vendedor sem acesso ao sistema": um user_profiles/auth.users
 * criado só pra poder ser escolhido como responsável de contrato
 * ou vendedor de edição (e assim receber comissão), sem que a
 * pessoa tenha login de verdade. Identificado pelo domínio de
 * e-mail sintético usado na criação — nunca existe de verdade,
 * então ninguém recebe e-mail de recuperação de senha nem
 * consegue entrar.
 */
export const SELLER_ONLY_EMAIL_DOMAIN =
  "sem-acesso.gpulso.internal";

export function isSellerOnlyEmail(
  email: string | null | undefined
) {
  return Boolean(
    email?.endsWith(
      `@${SELLER_ONLY_EMAIL_DOMAIN}`
    )
  );
}

export function slugifyName(
  name: string
) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
