import { describe, it } from "vitest";
import {
  apiScenarios,
  CONTRACT_PRIMARY,
  type ContractClient,
} from "../../../../packages/shared/contract/apiScenarios";
import { createFakeApi } from "./fakeApi";
import { createStore } from "./store";

// The API contract, run against the guest demo's fake API. The same scenarios run against the real
// server in apps/server/tests/apiContract.test.ts; both must pass.

/**
 * A fake API whose store holds only `CONTRACT_PRIMARY`, wrapped as a contract client. jsdom has no
 * canvas, so photo shrinking is a pass-through here (the real shrink is checked in the demo E2E).
 * @returns the client.
 */
function freshFakeClient(): ContractClient {
  const store = createStore({ people: [{ ...CONTRACT_PRIMARY, isPrimary: true, states: [], countries: [] }] });
  const api = createFakeApi(store, { shrinkPhoto: async (file) => file });

  return {
    async request(method, path, options = {}) {
      const init: RequestInit = { method };
      // A JSON body goes as JSON (as the web app sends it); a file goes as multipart form data.
      if (options.json !== undefined) {
        init.headers = { "Content-Type": "application/json" };
        init.body = JSON.stringify(options.json);
      }
      if (options.file) {
        const form = new FormData();
        form.append(options.file.field, new File([options.file.bytes as BlobPart], options.file.name, { type: options.file.type }));
        init.body = form;
      }

      const res = await api.handle(method, new URL(path, "http://demo.test"), init);
      const contentType = res.headers.get("Content-Type");
      const isJson = contentType?.includes("application/json") ?? false;
      const raw = await res.text();
      return {
        status: res.status,
        body: isJson && raw ? JSON.parse(raw) : null,
        text: !isJson && raw && !contentType?.startsWith("image/") ? raw : null,
        contentType: contentType?.split(";")[0] ?? null,
        cacheControl: res.headers.get("Cache-Control"),
      };
    },
  };
}

describe("API contract — demo fake API", () => {
  // One test per shared scenario, each with a brand-new store.
  for (const scenario of apiScenarios) {
    it(scenario.name, async () => {
      await scenario.run(freshFakeClient());
    });
  }
});
