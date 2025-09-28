export const DEFAULT_PAGE_SIZE = 24;

export type PaginationResult<T> = {
  items: T[];
  totalPages: number;
  isValid: boolean;
};

export function paginate<T>(
  collection: readonly T[],
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): PaginationResult<T> {
  const normalizedPageSize = Math.max(1, Math.floor(pageSize));
  const totalPages = Math.max(1, Math.ceil(collection.length / normalizedPageSize));
  const isValid = Number.isFinite(page) && page >= 1 && page <= totalPages;
  if (!isValid) {
    return { items: [], totalPages, isValid };
  }
  const start = (page - 1) * normalizedPageSize;
  const end = start + normalizedPageSize;
  return {
    items: collection.slice(start, end),
    totalPages,
    isValid,
  };
}
