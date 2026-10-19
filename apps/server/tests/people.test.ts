import { describe, it, expect, beforeEach } from "vitest";
import { signIn, type TestAgent } from "./helpers.js";

let api: TestAgent;

// Every test runs as a signed-in User (the database is wiped before each test).
beforeEach(async () => {
  api = await signIn("alice");
});

describe("People CRUD", () => {
  it("GET /api/people returns empty array initially", async () => {
    const res = await api.get("/api/people");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("POST /api/people creates a person", async () => {
    const res = await api
      .post("/api/people")
      .send({ name: "Alice", colorHex: "#ff0000" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Alice", colorHex: "#ff0000" });
    expect(res.body.id).toBeDefined();
    expect(res.body.createdAt).toBeDefined();
  });

  it("POST /api/people rejects missing name", async () => {
    const res = await api
      .post("/api/people")
      .send({ colorHex: "#ff0000" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("POST /api/people rejects invalid colorHex", async () => {
    const res = await api
      .post("/api/people")
      .send({ name: "Bob", colorHex: "not-a-color" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("POST /api/people rejects empty name", async () => {
    const res = await api
      .post("/api/people")
      .send({ name: "  ", colorHex: "#ff0000" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("GET /api/people lists created people in order", async () => {
    await api.post("/api/people").send({ name: "Alice", colorHex: "#ff0000" });
    await api.post("/api/people").send({ name: "Bob", colorHex: "#00ff00" });

    const res = await api.get("/api/people");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].name).toBe("Alice");
    expect(res.body[1].name).toBe("Bob");
  });

  it("PATCH /api/people/:id updates a person", async () => {
    const create = await api
      .post("/api/people")
      .send({ name: "Alice", colorHex: "#ff0000" });

    const res = await api
      .patch(`/api/people/${create.body.id}`)
      .send({ name: "Alicia" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Alicia");
    expect(res.body.colorHex).toBe("#ff0000");
  });

  it("PATCH /api/people/:id returns 404 for unknown id", async () => {
    const res = await api
      .patch("/api/people/nonexistent")
      .send({ name: "Ghost" });
    expect(res.status).toBe(404);
  });

  it("DELETE /api/people/:id deletes a person", async () => {
    const create = await api
      .post("/api/people")
      .send({ name: "Alice", colorHex: "#ff0000" });

    const del = await api.delete(`/api/people/${create.body.id}`);
    expect(del.status).toBe(204);

    const list = await api.get("/api/people");
    expect(list.body).toHaveLength(0);
  });

  it("DELETE /api/people/:id returns 404 for unknown id", async () => {
    const res = await api.delete("/api/people/nonexistent");
    expect(res.status).toBe(404);
  });

  it("DELETE /api/people/:id cascade-deletes visited states", async () => {
    const create = await api
      .post("/api/people")
      .send({ name: "Alice", colorHex: "#ff0000" });
    const id = create.body.id;

    await api.put(`/api/people/${id}/visits/CA`);
    await api.put(`/api/people/${id}/visits/NY`);

    await api.delete(`/api/people/${id}`);

    const visits = await api.get("/api/visits");
    expect(visits.body).toEqual([]);
  });
});
