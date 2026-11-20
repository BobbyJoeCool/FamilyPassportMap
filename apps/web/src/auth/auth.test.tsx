import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { jsonResponse, mockFetch } from "../test/api";
import { signInPath } from "./signInPath";
import { useCurrentUser } from "./useCurrentUser";

describe("signInPath", () => {
  it("points at /signin with the return path encoded", () => {
    expect(signInPath("/us/compare")).toBe("/signin?returnTo=%2Fus%2Fcompare");
  });

  it("keeps a query string intact through the round trip", () => {
    const path = signInPath("/world/map?view=Asia&x=1");
    expect(new URLSearchParams(path.split("?")[1]).get("returnTo")).toBe("/world/map?view=Asia&x=1");
  });
});

describe("useCurrentUser", () => {
  const me = {
    user: { id: "u1", email: "alice@example.com", displayName: "Alice", avatarUrl: null },
    primaryPersonId: "p1",
  };

  it("starts loading, then becomes ready with the signed-in User", async () => {
    mockFetch({ "GET /api/me": me });
    const { result } = renderHook(() => useCurrentUser());
    expect(result.current).toEqual({ status: "loading" });
    await waitFor(() => expect(result.current).toEqual({ status: "ready", currentUser: me }));
  });

  it("is signedOut when the server answers 401", async () => {
    mockFetch({ "GET /api/me": jsonResponse(401) });
    const { result } = renderHook(() => useCurrentUser());
    await waitFor(() => expect(result.current).toEqual({ status: "signedOut" }));
  });

  it("is error, with the message, when the server can't be reached", async () => {
    mockFetch({
      "GET /api/me": () => {
        throw new TypeError("Failed to fetch");
      },
    });
    const { result } = renderHook(() => useCurrentUser());
    await waitFor(() => expect(result.current).toEqual({ status: "error", message: "Failed to fetch" }));
  });

  it("asks the server only once", async () => {
    const { calls } = mockFetch({ "GET /api/me": me });
    const { result, rerender } = renderHook(() => useCurrentUser());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    rerender();
    expect(calls).toHaveLength(1);
  });
});
