import path from "node:path";
import express from "express";
import { UPLOADS_DIR } from "./env.js";
import { peopleRouter } from "./routes/people.js";
import { bulkVisitsRouter, visitsRouter } from "./routes/visits.js";

export const app = express();

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/people", peopleRouter);
app.use("/api/people/:id/visits", visitsRouter);
app.use("/api/visits", bulkVisitsRouter);
app.use("/uploads", express.static(UPLOADS_DIR));

if (process.env.NODE_ENV === "production") {
  const webDist = path.resolve(import.meta.dirname, "../../web/dist");
  app.use(express.static(webDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
}
