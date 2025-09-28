import Link from "next/link";
import styles from "./styles/PaginationNav.module.css";

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function ensureTrailingSlash(path: string) {
  return path.endsWith("/") ? path : `${path}/`;
}

function buildHref(basePath: string, page: number) {
  const normalized = ensureTrailingSlash(basePath);
  if (page <= 1) {
    return normalized;
  }
  return `${normalized}page/${page}/`;
}

function buildPageList(currentPage: number, totalPages: number) {
  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);
  for (let page = currentPage - 2; page <= currentPage + 2; page += 1) {
    if (page >= 1 && page <= totalPages) {
      pages.add(page);
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}

function shouldShowEllipsis(previous: number, current: number) {
  return current - previous > 1;
}

type PaginationNavProps = {
  basePath: string;
  currentPage: number;
  totalPages: number;
};

export default function PaginationNav({
  basePath,
  currentPage,
  totalPages,
}: PaginationNavProps) {
  const pages = buildPageList(currentPage, totalPages);
  const previousPage = currentPage - 1;
  const nextPage = currentPage + 1;

  return (
    <nav className={styles.nav} aria-label="Pagination">
      <ul className={styles.list}>
        <li>
          {currentPage > 1 ? (
            <Link className={styles.link} href={buildHref(basePath, previousPage)}>
              &#x2039;
              <span className={styles.srOnly}>Page précédente</span>
            </Link>
          ) : (
            <span className={classNames(styles.link, styles.disabled)} aria-disabled="true">
              &#x2039;
            </span>
          )}
        </li>
        {pages.map((page, index) => {
          const previous = pages[index - 1];
          return (
            <li key={page}>
              {index > 0 && shouldShowEllipsis(previous, page) && (
                <span className={styles.link} aria-hidden="true">
                  &hellip;
                </span>
              )}
              <Link
                className={classNames(
                  styles.link,
                  page === currentPage && styles.active,
                )}
                href={buildHref(basePath, page)}
                aria-current={page === currentPage ? "page" : undefined}
              >
                {page}
              </Link>
            </li>
          );
        })}
        <li>
          {currentPage < totalPages ? (
            <Link className={styles.link} href={buildHref(basePath, nextPage)}>
              &#x203a;
              <span className={styles.srOnly}>Page suivante</span>
            </Link>
          ) : (
            <span className={classNames(styles.link, styles.disabled)} aria-disabled="true">
              &#x203a;
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
