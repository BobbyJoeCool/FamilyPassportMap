import "dotenv/config";
import express from "express";
import { UPLOADS_DIR } from "./env.js";
import { peopleRouter } from "./routes/people.js";
import { visitsRouter } from "./routes/visits.js";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/people", peopleRouter);
app.use("/api/people/:id/visits", visitsRouter);
app.use("/uploads", express.static(UPLOADS_DIR));

app.listen(port, () => {
  console.log(`FamilyPassportMap server listening on http://localhost:${port}`);
});
