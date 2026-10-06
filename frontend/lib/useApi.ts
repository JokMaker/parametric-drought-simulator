"use client";

import { useEffect, useState } from "react";

type State<T> = { key: string; data?: T; error?: string };

/**
 * Loads data on the client. `key` identifies the request; when it changes the
 * hook reports loading until the new result arrives.
 */
export function useApi<T>(key: string, load: () => Promise<T>) {
  const [state, setState] = useState<State<T>>({ key: "" });

  useEffect(() => {
    let alive = true;
    load().then(
      (data) => alive && setState({ key, data }),
      (e: Error) => alive && setState({ key, error: e.message }),
    );
    return () => {
      alive = false;
    };
    // `load` is recreated every render; `key` captures what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loading = state.key !== key;
  return {
    data: loading ? undefined : state.data,
    error: loading ? undefined : state.error,
    loading,
  };
}
