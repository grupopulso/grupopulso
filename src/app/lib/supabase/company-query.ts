export function applyCompanyFilter<
  T extends {
    eq: (
      column: string,
      value: string
    ) => T;
  }
>(
  query: T,
  companyId: string | null,
  column = "company_id"
) {
  if (!companyId) {
    return query;
  }

  return query.eq(
    column,
    companyId
  );
}