import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  analyzeDocQuality,
  compareFaces,
  analyzeLiveness,
} from "./faceService.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async () => ({ ok: true }));
app.get("/ready", async () => ({ ok: true }));

// POST /analyze-doc  { image: "data:image/jpeg;base64,..." }
app.post<{ Body: { image: string } }>("/analyze-doc", async (req, reply) => {
  const { image } = req.body ?? {};
  if (!image || typeof image !== "string") {
    return reply.status(400).send({ error: "Missing image (base64 data URL)" });
  }
  try {
    const score = await analyzeDocQuality(image);
    return { score };
  } catch (err) {
    req.log.error(err);
    return reply.status(500).send({ error: "Analysis failed" });
  }
});

// POST /compare-faces  { document: "...", selfie: "..." }
app.post<{
  Body: { document: string; selfie: string };
}>("/compare-faces", async (req, reply) => {
  const { document, selfie } = req.body ?? {};
  if (!document || !selfie || typeof document !== "string" || typeof selfie !== "string") {
    return reply.status(400).send({ error: "Missing document or selfie (base64)" });
  }
  try {
    const score = await compareFaces(document, selfie);
    return { score };
  } catch (err) {
    req.log.error(err);
    return reply.status(500).send({ error: "Comparison failed" });
  }
});

// POST /analyze-liveness  { image: "data:image/jpeg;base64,..." }
app.post<{ Body: { image: string } }>("/analyze-liveness", async (req, reply) => {
  const { image } = req.body ?? {};
  if (!image || typeof image !== "string") {
    return reply.status(400).send({ error: "Missing image (base64 data URL)" });
  }
  try {
    const score = await analyzeLiveness(image);
    return { score };
  } catch (err) {
    req.log.error(err);
    return reply.status(500).send({ error: "Liveness analysis failed" });
  }
});

const port = Number(process.env.PORT) || 3001;
await app.listen({ port, host: "0.0.0.0" });
console.log(`KYC API running at http://localhost:${port}`);
