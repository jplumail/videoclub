export type Limiter = <T>(fn: () => Promise<T>) => Promise<T>;

export function createLimiter(maxConcurrent: number): Limiter {
  let active = 0;
  const queue: Array<() => void> = [];
  async function acquire() {
    await new Promise<void>((resolve) => {
      if (active < maxConcurrent) {
        active += 1;
        resolve();
      } else {
        queue.push(() => {
          active += 1;
          resolve();
        });
      }
    });
  }
  function release() {
    active = Math.max(0, active - 1);
    const next = queue.shift();
    if (next) next();
  }
  return async function withLimit<T>(fn: () => Promise<T>): Promise<T> {
    await acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  };
}

export interface RetryOptions {
  maxAttempts: number; // total attempts including initial
  baseBackoffMs: number;
  maxBackoffMs: number;
  jitterMs: number;
  retryable: (status: number) => boolean;
  honorRetryAfter?: boolean;
}

export interface FetchMeta {
  retries: number;
  durationMs: number;
  at: string;
}

export type FetchWithRetryResult<T = unknown> =
  | { ok: true; data: T; meta: FetchMeta }
  | {
      ok: false;
      status: number | null;
      bodyPreview?: string;
      error?: unknown;
      meta: FetchMeta;
    };

export async function fetchWithRetry<T = unknown>(
  url: string,
  init: RequestInit,
  options: RetryOptions,
  withLimit?: Limiter,
): Promise<FetchWithRetryResult<T>> {
  const run = async (): Promise<FetchWithRetryResult<T>> => {
    const start = Date.now();
    let status: number | null = null;
    let bodyPreview: string | undefined;
    let lastError: unknown;
    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      const isLast = attempt === options.maxAttempts;
      try {
        const res = await fetch(url, init);
        status = res.status;
        if (res.ok) {
          try {
            const data = (await res.json()) as T;
            return {
              ok: true,
              data,
              meta: { retries: attempt - 1, durationMs: Date.now() - start, at: new Date().toISOString() },
            };
          } catch {
            // Not JSON; treat as failure
            if (!isLast) {
              await delayMs(backoff(attempt - 1, options));
              continue;
            }
            return {
              ok: false,
              status,
              meta: { retries: attempt - 1, durationMs: Date.now() - start, at: new Date().toISOString() },
            };
          }
        }
        // capture a short body preview
        try {
          bodyPreview = (await res.text()).slice(0, 160);
        } catch {}
        if (options.retryable(status) && !isLast) {
          const ra = options.honorRetryAfter ? res.headers.get("retry-after") : null;
          await delayMs(backoff(attempt - 1, options, ra || undefined));
          continue;
        }
        return {
          ok: false,
          status,
          bodyPreview,
          meta: { retries: attempt - 1, durationMs: Date.now() - start, at: new Date().toISOString() },
        };
      } catch (e) {
        lastError = e;
        if (!isLast) {
          await delayMs(backoff(attempt - 1, options));
          continue;
        }
        return {
          ok: false,
          status,
          error: lastError,
          meta: { retries: attempt - 1, durationMs: Date.now() - start, at: new Date().toISOString() },
        };
      }
    }
    // Should not be reached
    return {
      ok: false,
      status,
      bodyPreview,
      error: lastError,
      meta: { retries: options.maxAttempts - 1, durationMs: Date.now() - start, at: new Date().toISOString() },
    };
  };
  return withLimit ? withLimit(run) : run();
}

function delayMs(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function backoff(attemptIndex: number, options: RetryOptions, retryAfter?: string) {
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (!Number.isNaN(secs)) return Math.max(0, secs) * 1000;
    const date = new Date(retryAfter).getTime();
    return Math.max(0, date - Date.now());
  }
  const exp = Math.min(
    options.baseBackoffMs * Math.pow(2, attemptIndex),
    options.maxBackoffMs,
  );
  const jitter = Math.floor(Math.random() * options.jitterMs);
  return exp + jitter;
}
