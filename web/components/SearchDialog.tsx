"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Fuse from "fuse.js";
import type { FuseIndex } from "fuse.js";
import { createPortal } from "react-dom";
import styles from "@/components/styles/search.module.css";

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

type SearchDialogProps = {
  buttonClassName?: string;
};

const KIND_LABEL: Record<SearchKind, string> = {
  film: "Film",
  serie: "Série",
  personne: "Personne",
};

export default function SearchDialog({ buttonClassName }: SearchDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchDocument[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const fuseRef = useRef<Fuse<SearchDocument> | null>(null);
  const documentsRef = useRef<SearchDocument[]>([]);
  const loadPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isMounted) return;
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, isMounted]);

  useEffect(() => {
    if (!isOpen) return;
    if (loadPromiseRef.current) return;
    loadPromiseRef.current = loadIndex();

    async function loadIndex() {
      if (fuseRef.current) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/search-index.json", { cache: "force-cache" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = (await response.json()) as SearchIndexPayload;
        documentsRef.current = payload.documents;
        const parsedIndex = Fuse.parseIndex<SearchDocument>(payload.fuse.index);
        fuseRef.current = new Fuse(
          documentsRef.current,
          {
            keys: payload.fuse.keys,
            includeScore: true,
            ignoreLocation: true,
            threshold: 0.35,
            minMatchCharLength: 2,
          },
          parsedIndex,
        );
      } catch (err) {
        console.error("Failed to load search index", err);
        setError("Impossible de charger la recherche");
      } finally {
        setLoading(false);
        if (!fuseRef.current) {
          loadPromiseRef.current = null;
        }
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!query.trim()) {
      setResults([]);
      setActiveIndex(0);
      return;
    }
    if (!fuseRef.current) return;
    const matches = fuseRef.current.search(query, { limit: 12 });
    setResults(matches.map((match) => match.item));
    setActiveIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setResults([]);
    setActiveIndex(0);
  }, [isOpen, pathname]);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setActiveIndex(0);
  }, []);

  const handleSubmit = useCallback(() => {
    const selected = results[activeIndex];
    if (!selected) return;
    router.push(selected.url);
    close();
  }, [activeIndex, close, results, router]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (!results.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => Math.min(current + 1, results.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => Math.max(current - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, results.length],
  );

  const overlay = useMemo(() => {
    if (!isMounted || !isOpen) return null;
    return createPortal(
      <div
        className={styles.overlay}
        role="dialog"
        aria-modal="true"
        aria-label="Recherche"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className={styles.panel} id="search-dialog">
          <div className={styles.header}>
            <input
              ref={inputRef}
              className={styles.input}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher un film, une série ou une personne"
              aria-label="Recherche"
            />
            <button type="button" className={styles.closeButton} onClick={close}>
              ✕
            </button>
          </div>
          <div className={styles.status}>
            {loading && <span>Chargement…</span>}
            {!loading && error && <span>{error}</span>}
            {!loading && !error && query && !results.length && <span>Aucun résultat</span>}
            {!loading && !error && !query && <span>Tapez au moins deux caractères</span>}
          </div>
          {!!results.length && !loading && !error && (
            <ul className={styles.results} role="listbox">
              {results.map((item, index) => (
                <li key={`${item.kind}-${item.id}`}>
                  <Link
                    href={item.url}
                    className={`${styles.result} ${index === activeIndex ? styles.resultActive : ""}`}
                    onClick={close}
                  >
                    <span className={styles.kind}>{KIND_LABEL[item.kind]}</span>
                    <span className={styles.title}>{item.title}</span>
                    {item.metadata?.releaseYear && (
                      <span className={styles.meta}>{item.metadata.releaseYear}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>,
      document.body,
    );
  }, [activeIndex, close, error, handleKeyDown, isMounted, isOpen, loading, query, results]);

  return (
    <>
      <button
        type="button"
        className={`${styles.trigger} ${buttonClassName ?? ""}`.trim()}
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="search-dialog"
      >
        <span className={styles.triggerIcon} aria-hidden="true" />
        <span>Recherche</span>
      </button>
      {overlay}
    </>
  );
}
