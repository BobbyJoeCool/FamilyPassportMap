import { describe, it, expect, vi, beforeEach } from "vitest";
import { jsonResponse } from "../test/api";

vi.mock("../navigation", () => ({ loadPage: vi.fn() }));
const { loadPage } = await import("../navigation");
const { handleResponse, redirectToSignIn } = await import("./http");

beforeEach(() => {
  vi.mocked(loadPage).mockClear();
  window.history.replaceState(null, "", "/world/list?view=Europe");
});

describe("handleResponse", () => {
  it("returns the parsed JSON body of a success", async () => {
    await expect(handleResponse(jsonResponse(200, { id: "p1" }))).resolves.toEqual({ id: "p1" });
  });

  it("returns undefined for 204 No Content", async () => {
    await expect(handleResponse(jsonResponse(204))).resolves.toBeUndefined();
  });

  it("throws the server's error message for a failure", async () => {
    await expect(handleResponse(jsonResponse(400, { error: "Name is required" }))).rejects.toThrow("Name is required");
  });

  it("falls back to the status when the error body isn't JSON", async () => {
    await expect(handleResponse(new Response("<html>Bad gateway</html>", { status: 502 }))).rejects.toThrow(
      "Request failed with status 502",
    );
  });

  it("falls back to the status when the JSON has no error field", async () => {
    await expect(handleResponse(jsonResponse(500, { message: "oops" }))).rejects.toThrow("Request failed with status 500");
  });

  it("sends a 401 to sign-in, coming back to the current page", async () => {
    await expect(handleResponse(jsonResponse(401, { error: "Not signed in" }))).rejects.toThrow("Not signed in");
    expect(loadPage).toHaveBeenCalledWith("/signin?returnTo=%2Fworld%2Flist%3Fview%3DEurope");
  });

  it("does not redirect for other failures", async () => {
    await handleResponse(jsonResponse(404, { error: "Person not found" })).catch(() => {});
    expect(loadPage).not.toHaveBeenCalled();
  });
});

describe("redirectToSignIn", () => {
  it("keeps the current path and query as the return target", () => {
    window.history.replaceState(null, "", "/people");
    redirectToSignIn();
    expect(loadPage).toHaveBeenCalledWith("/signin?returnTo=%2Fpeople");
  });
});
