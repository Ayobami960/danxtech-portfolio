"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Safety net for a task whose promise never settles (for example a transport
 * that has no timeout). It is deliberately longer than the API's 8s timeout so
 * a slow-but-valid request is not hidden early. The loader can never be stuck
 * on the screen longer than this.
 */
const TASK_TIMEOUT_MS = 20_000;

type TaskOptions = {
  /** Overrides `TASK_TIMEOUT_MS` for one task. */
  timeoutMs?: number;
};

type GlobalLoadingContextValue = {
  /** True while at least one tracked initial task is running. */
  isLoading: boolean;
  /**
   * Register one pending task and return its idempotent release function.
   * Called again after release, it does nothing.
   */
  begin: (options?: TaskOptions) => () => void;
  /** Run a promise under the global loader; the loader is released on settle. */
  track: <T>(task: Promise<T>, options?: TaskOptions) => Promise<T>;
};

const GlobalLoadingContext = createContext<GlobalLoadingContextValue | null>(null);

/**
 * Application-level loading manager for client-side initial data.
 *
 * The landing and project pages fetch on the server, so their single loader is
 * the route-level `loading.tsx` boundary. Pages that must open a session in the
 * browser (the chat page) register that work here. Every task is tracked in a
 * Set and the visible count is derived from the Set's size, so finishing tasks
 * out of order can never dismiss the loader early or drive the count negative.
 */
export function GlobalLoadingProvider({ children }: { children: ReactNode }) {
  const pending = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const nextId = useRef(0);
  const [count, setCount] = useState(0);

  const sync = useCallback(() => {
    setCount(pending.current.size);
  }, []);

  const begin = useCallback(
    (options: TaskOptions = {}) => {
      const id = nextId.current++;
      const timer = setTimeout(() => {
        pending.current.delete(id);
        sync();
      }, options.timeoutMs ?? TASK_TIMEOUT_MS);
      pending.current.set(id, timer);
      sync();

      let released = false;
      return () => {
        if (released) return;
        released = true;
        const current = pending.current.get(id);
        if (current) clearTimeout(current);
        pending.current.delete(id);
        sync();
      };
    },
    [sync],
  );

  const track = useCallback(
    async <T,>(task: Promise<T>, options: TaskOptions = {}): Promise<T> => {
      const release = begin(options);
      try {
        return await task;
      } finally {
        release();
      }
    },
    [begin],
  );

  useEffect(() => {
    const tasks = pending;
    return () => {
      tasks.current.forEach((timer) => clearTimeout(timer));
      tasks.current.clear();
    };
  }, []);

  const value = useMemo<GlobalLoadingContextValue>(
    () => ({ isLoading: count > 0, begin, track }),
    [count, begin, track],
  );

  return (
    <GlobalLoadingContext.Provider value={value}>{children}</GlobalLoadingContext.Provider>
  );
}

export const useGlobalLoading = (): GlobalLoadingContextValue => {
  const value = useContext(GlobalLoadingContext);
  if (!value) {
    throw new Error("useGlobalLoading must be used inside GlobalLoadingProvider.");
  }
  return value;
};
