import { describe, expect, it } from "vitest";
import {
  apiScenarios,
  CONTRACT_PRIMARY,
  type ContractClient,
  type ContractResponse,
} from "../../../packages/shared/contract/apiScenarios.js";
import { signIn } from "./helpers.js";

// The API contract, run against the real server. The same scenarios run against the guest demo's
// fake API in apps/web/src/demo/apiContract.test.ts; both must pass.

let userCount = 0;

/**
 * A signed-in User who has finished the welcome step with `CONTRACT_PRIMARY`, wrapped as a
 * contract client over Supertest.
 * @returns the client.
 */
async function freshServerClient(): Promise<ContractClient> {
  const agent = await signIn(`contract${++userCount}`);
  const welcome = await agent.post("/api/me/primary-person").send(CONTRACT_PRIMARY);
  expect(welcome.status).toBe(201);

  return {
    async request(method, path, options = {}) {
      let req = agent[method.toLowerCase() as "get" | "post" | "put" | "patch" | "delete"](path);
      // A JSON body goes as JSON; a file goes as a multipart upload; otherwise no body at all.
      if (options.json !== undefined) req = req.send(options.json as object);
      if (options.file) {
        req = req.attach(options.file.field, Buffer.from(options.file.bytes), {
          filename: options.file.name,
          contentType: options.file.type,
        });
      }
      const res = await req;
      const contentType = (res.headers["content-type"] as string | undefined) ?? null;
      const isJson = contentType?.includes("application/json") ?? false;
      const response: ContractResponse = {
        status: res.status,
        body: isJson ? res.body : null,
        // Supertest only fills `text` for text responses; images come back as a Buffer body.
        text: !isJson && typeof res.text === "string" && res.text !== "" ? res.text : null,
        contentType: contentType?.split(";")[0] ?? null,
        cacheControl: (res.headers["cache-control"] as string | undefined) ?? null,
      };
      return response;
    },
  };
}

describe("API contract — real server", () => {
  // One test per shared scenario, each with a brand-new User (the database is wiped per test).
  for (const scenario of apiScenarios) {
    it(scenario.name, async () => {
      await scenario.run(await freshServerClient());
    });
  }
});
