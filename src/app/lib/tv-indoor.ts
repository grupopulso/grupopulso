/*
 * Contrato de TV Indoor (Pottencializa) tem exclusividade: o cliente
 * paga 100%, mas só 50% entra de fato na conta da empresa (o resto
 * fica com quem hospeda as TVs, fora do sistema). Qualquer total de
 * "recebido"/receita da empresa precisa aplicar esse fator.
 * O que o CLIENTE deve/pagou continua 100%.
 */
export const TV_INDOOR_PRODUCT_ID =
  "968e4198-c946-4ea3-abf0-a8b2521b7474";

export const TV_INDOOR_COMPANY_SHARE = 0.5;

export function getCompanyShareFactor(
  productId: string | null | undefined
) {
  return productId === TV_INDOOR_PRODUCT_ID
    ? TV_INDOOR_COMPANY_SHARE
    : 1;
}
