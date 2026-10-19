import { useEffect, useState } from "react";
import type { CurrentUserResponse } from "@familypassportmap/shared";
import { fetchCurrentUser } from "../api/auth";

/** Where the app is in finding out who's signed in. */
export type CurrentUserState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "error"; message: string }
  | { status: "ready"; currentUser: CurrentUserResponse };

/**
 * Loads the signed-in User once when the app starts.
 * @returns the current sign-in state.
 */
export function useCurrentUser(): CurrentUserState {
  const [state, setState] = useState<CurrentUserState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((currentUser) => {
        // Ignore a response that lands after unmount (StrictMode double-mount in dev).
        if (cancelled) return;
        // The server answers null for "nobody signed in".
        setState(currentUser ? { status: "ready", currentUser } : { status: "signedOut" });
      })
      .catch((error: unknown) => {
        // Same late-response guard as above.
        if (cancelled) return;
        setState({ status: "error", message: error instanceof Error ? error.message : "Couldn't reach the server" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
