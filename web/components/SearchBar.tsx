"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Fuse from "fuse.js";
import type { FuseIndex } from "fuse.js";
import styles from "@/components/styles/searchBar.module.css";

type SearchKind = "film" | "serie" | "personne";

type SearchDocument = {
  id: string;
  kind: SearchKind;
  title: string;
  url: string;
  metadata?: {
    releaseYear?: string | null;
  };
};

type SerializedFuseIndex = ReturnType<FuseIndex<SearchDocument>["toJSON"]>;

type SearchIndexPayload = {
  generatedAt: string;
  documents: SearchDocument[];
  fuse: {
    keys: ReadonlyArray<string>;
    index: SerializedFuseIndex;
  };
};

type SearchBarProps = {
  className?: string;
};

const KIND_LABEL: Record<SearchKind, string> = {
  film: "Film",
  serie: "Série",
  personne: "Personne",
};

const COMPACT_QUERY = "(max-width: 640px)";

function extractYear(value: string | null | undefined) {
  if (!value) return undefined;
  const year = new Date(value).getFullYear();
  return Number.isNaN(year) ? undefined : year;
}

export default function SearchBar({ className }: SearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchDocument[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCompact, setIsCompact] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fuseRef = useRef<Fuse<SearchDocument> | null>(null);
  const documentsRef = useRef<SearchDocument[]>([]);
  const loadPromiseRef = useRef<Promise<void> | null>(null);
  const latestQueryRef = useRef("");

  const ensureIndex = useCallback(async () => {
    if (fuseRef.current || loadPromiseRef.current) return loadPromiseRef.current;
    loadPromiseRef.current = (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/search-index.json", { cache: "force-cache" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as SearchIndexPayload;
        documentsRef.current = payload.documents;
        const parsedIndex = Fuse.parseIndex<SearchDocument>(payload.fuse.index);
        fuseRef.current = new Fuse(
          documentsRef.current,
          {
            keys: Array.from(payload.fuse.keys),
            includeScore: true,
            ignoreLocation: true,
            threshold: 0,
            minMatchCharLength: 2,
            ignoreDiacritics: true,
          },
          parsedIndex,
        );
      } catch (err) {
        console.error("Failed to load search index", err);
        setError("Impossible de charger la recherche");
      } finally {
        setLoading(false);
        loadPromiseRef.current = null;
      }
    })();
    return loadPromiseRef.current;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia(COMPACT_QUERY);
    const updateMode = () => {
      setIsCompact(mediaQuery.matches);
    };
    updateMode();
    const handler = (event: MediaQueryListEvent) => setIsCompact(event.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (isCompact) {
      setQuery("");
      setResults([]);
      setActiveIndex(-1);
    }
  }, [isCompact]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setActiveIndex(-1);
      return;
    }
    setResults([]);
    setActiveIndex(-1);
    let cancelled = false;
    const run = async () => {
      await ensureIndex();
      if (cancelled || !fuseRef.current) return;
      const nextQuery = latestQueryRef.current.trim();
      if (nextQuery.length < 2) return;
      const limit = isCompact ? 6 : 12;
      const matches = fuseRef.current.search(nextQuery, { limit });
      setResults(matches.map((match) => match.item));
      setActiveIndex(matches.length ? 0 : -1);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [ensureIndex, isCompact, query]);

  useEffect(() => {
    setQuery("");
    setResults([]);
    setActiveIndex(-1);
  }, [pathname, isCompact]);

  useEffect(() => {
    latestQueryRef.current = query;
  }, [query]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    ensureIndex();
  }, [ensureIndex]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        setQuery("");
        setResults([]);
        setActiveIndex(-1);
        return;
      }
      if (!results.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) =>
          current + 1 >= results.length ? 0 : current + 1,
        );
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) =>
          current - 1 < 0 ? results.length - 1 : current - 1,
        );
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (activeIndex >= 0) {
          const selected = results[activeIndex];
          router.push(selected.url);
          setQuery("");
          setResults([]);
        }
      }
    },
    [activeIndex, results, router],
  );

  const handleSelect = useCallback(
    (item: SearchDocument) => {
      router.push(item.url);
      setQuery("");
      setResults([]);
    },
    [router],
  );

  const showInput = true;

  const showResults =
    !loading && !error && query.trim().length >= 2 && results.length > 0;

  const resolvedClassName = [
    styles.container,
    className,
    isCompact ? styles.compact : styles.desktop,
    showInput ? styles.open : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={containerRef} className={resolvedClassName}>
      {showInput && (
        <div className={styles.panel}>
          <div
            className={`${styles.inputRow} ${isFocused ? styles.inputRowFocused : ""}`}
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className={styles.icon}
            >
              <path d="M14.0857 8.74999C14.0857 5.80355 11.6972 3.41503 8.75073 3.41503C5.80429 3.41503 3.41577 5.80355 3.41577 8.74999C3.41577 11.6964 5.80429 14.085 8.75073 14.085C11.6972 14.085 14.0857 11.6964 14.0857 8.74999ZM15.4158 8.74999C15.4158 10.3539 14.848 11.8245 13.9041 12.9746L13.9705 13.0303L16.9705 16.0303L17.0564 16.1338C17.2269 16.3919 17.1977 16.7434 16.9705 16.9707C16.7432 17.1975 16.3925 17.226 16.1345 17.0557L16.03 16.9707L13.03 13.9707L12.9753 13.9033C11.8253 14.8472 10.3547 15.415 8.75073 15.415C5.06975 15.415 2.08569 12.431 2.08569 8.74999C2.08569 5.06901 5.06975 2.08495 8.75073 2.08495C12.4317 2.08495 15.4158 5.06901 15.4158 8.74999Z"></path>
            </svg>
            <input
              ref={inputRef}
              className={styles.input}
              type="search"
              value={query}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher"
              aria-label="Recherche"
            />
          </div>
        </div>
      )}

      {showResults && (
        <ul className={styles.results} role="listbox">
          {results.map((item, index) => {
            const isActive = index === activeIndex;
            const year = extractYear(item.metadata?.releaseYear);
            const subtitle =
              item.kind === "personne"
                ? undefined
                : year?.toString();
            return (
              <li key={`${item.kind}-${item.id}`}>
                <Link
                  href={item.url}
                  className={`${styles.result} ${isActive ? styles.resultActive : ""}`}
                  onClick={(event) => {
                    event.preventDefault();
                    handleSelect(item);
                  }}
                >
                  <span className={styles.kind}>{KIND_LABEL[item.kind]}</span>
                  <span className={styles.title}>{item.title}</span>
                  {subtitle && <span className={styles.meta}>{subtitle}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
