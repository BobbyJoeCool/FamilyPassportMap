import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

let personId: string;

beforeEach(async () => {
  const res = await request(app)
    .post("/api/people")
    .send({ name: "Alice", colorHex: "#3366cc" });
  personId = res.body.id;
});

describe("Per-person visits", () => {
  it("GET /api/people/:id/visits returns empty array initially", async () => {
    const res = await request(app).get(`/api/people/${personId}/visits`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("PUT /api/people/:id/visits/:stateCode marks a state visited", async () => {
    const put = await request(app).put(`/api/people/${personId}/visits/CA`);
    expect(put.status).toBe(204);

    const get = await request(app).get(`/api/people/${personId}/visits`);
    expect(get.body).toEqual(["CA"]);
  });

  it("PUT is idempotent — marking the same state twice succeeds", async () => {
    await request(app).put(`/api/people/${personId}/visits/NY`);
    const res = await request(app).put(`/api/people/${personId}/visits/NY`);
    expect(res.status).toBe(204);

    const get = await request(app).get(`/api/people/${personId}/visits`);
    expect(get.body).toEqual(["NY"]);
  });

  it("PUT normalizes state code to uppercase", async () => {
    const res = await request(app).put(`/api/people/${personId}/visits/ca`);
    expect(res.status).toBe(204);

    const get = await request(app).get(`/api/people/${personId}/visits`);
    expect(get.body).toEqual(["CA"]);
  });

  it("PUT rejects invalid state code", async () => {
    const res = await request(app).put(`/api/people/${personId}/visits/ZZ`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unknown state/i);
  });

  it("PUT returns 404 for nonexistent person", async () => {
    const res = await request(app).put("/api/people/nonexistent/visits/CA");
    expect(res.status).toBe(404);
  });

  it("DELETE /api/people/:id/visits/:stateCode unmarks a state", async () => {
    await request(app).put(`/api/people/${personId}/visits/CA`);

    const del = await request(app).delete(`/api/people/${personId}/visits/CA`);
    expect(del.status).toBe(204);

    const get = await request(app).get(`/api/people/${personId}/visits`);
    expect(get.body).toEqual([]);
  });

  it("DELETE is idempotent — removing an unvisited state succeeds", async () => {
    const res = await request(app).delete(`/api/people/${personId}/visits/TX`);
    expect(res.status).toBe(204);
  });

  it("DELETE returns 404 for nonexistent person", async () => {
    const res = await request(app).delete("/api/people/nonexistent/visits/CA");
    expect(res.status).toBe(404);
  });

  it("GET returns 404 for nonexistent person", async () => {
    const res = await request(app).get("/api/people/nonexistent/visits");
    expect(res.status).toBe(404);
  });
});

describe("Bulk visits", () => {
  it("GET /api/visits returns empty array with no visits", async () => {
    const res = await request(app).get("/api/visits");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("GET /api/visits groups visits by person", async () => {
    const bob = await request(app)
      .post("/api/people")
      .send({ name: "Bob", colorHex: "#00ff00" });

    await request(app).put(`/api/people/${personId}/visits/CA`);
    await request(app).put(`/api/people/${personId}/visits/NY`);
    await request(app).put(`/api/people/${bob.body.id}/visits/TX`);

    const res = await request(app).get("/api/visits");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    const aliceVisits = res.body.find((v: { personId: string }) => v.personId === personId);
    const bobVisits = res.body.find((v: { personId: string }) => v.personId === bob.body.id);

    expect(aliceVisits.stateCodes).toHaveLength(2);
    expect(aliceVisits.stateCodes).toContain("CA");
    expect(aliceVisits.stateCodes).toContain("NY");
    expect(bobVisits.stateCodes).toEqual(["TX"]);
  });
});
