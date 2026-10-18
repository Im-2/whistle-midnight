// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Personas, type Status } from './api';

export const short = (h: string, a = 10, b = 6) => (h.length > a + b + 1 ? `${h.slice(0, a)}…${h.slice(-b)}` : h);

export type Flash = { kind: 'ok' | 'err'; text: string } | null;

/** Runs an async action with loading and success/error feedback. Errors arrive already in plain English. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const run = async <T,>(fn: () => Promise<T>, ok: (r: T) => string): Promise<T | undefined> => {
    setBusy(true);
    setFlash(null);
    try {
      const r = await fn();
      setFlash({ kind: 'ok', text: ok(r) });
      return r;
    } catch (e) {
      setFlash({ kind: 'err', text: e instanceof Error ? e.message : 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  };
  return { busy, flash, run, clear: () => setFlash(null) };
}

export type Live = {
  status: Status | null;
  personas: Personas | null;
  error: string | null;
  loading: boolean;
  updatedAt: number | null;
  refresh: () => Promise<void>;
};

/** Public state plus personas, refreshed every few seconds while the tab is visible. */
export function useLive(intervalMs = 5000): Live {
  const [status, setStatus] = useState<Status | null>(null);
  const [personas, setPersonas] = useState<Personas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const [s, p] = await Promise.all([api.status(), api.personas()]);
      setStatus(s);
      setPersonas(p);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, intervalMs);
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, intervalMs]);

  return { status, personas, error, loading, updatedAt, refresh };
}

/** Seconds since `t`, ticking once a second. */
export function useAgo(t: number | null): number | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, []);
  return t === null ? null : Math.max(0, Math.round((Date.now() - t) / 1000));
}
