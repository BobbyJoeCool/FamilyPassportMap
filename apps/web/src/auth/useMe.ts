import { useEffect, useState } from "react";
import type { Me } from "@familypassportmap/shared";
import { fetchMe } from "../api/auth";

/** Where the app is in finding out who's signed in. */
export type MeState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "error"; message: string }
  | { status: "ready"; me: Me };

/**
 * Loads the signed-in User once when the app starts.
 * @returns the current sign-in state.
 */
export function useMe(): MeState {
  const [state, setState] = useState<MeState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((me) => {
        // Ignore a response that lands after unmount (StrictMode double-mount in dev).
        if (cancelled) return;
        setState(me ? { status: "ready", me } : { status: "signedOut" });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ status: "error", message: error instanceof Error ? error.message : "Couldn't reach the server" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
