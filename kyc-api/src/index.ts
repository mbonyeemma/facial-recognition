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

// GET /config - countries & doc types (no hardcoding in frontend)
const DEFAULT_COUNTRIES = [
  { code: "UG", name: "Uganda", flag: "🇺🇬", docs: ["National ID", "Passport", "Driving Permit"] },
  { code: "KE", name: "Kenya", flag: "🇰🇪", docs: ["National ID", "Passport", "Driving Licence"] },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿", docs: ["National ID", "Passport", "Driving Licence"] },
];
app.get("/config", async () => ({ countries: DEFAULT_COUNTRIES }));

// POST /analyze-doc  { image: "...", sessionId?: string, type?: "doc"|"docBack" }
app.post<{ Body: { image: string; sessionId?: string; type?: "doc" | "docBack" } }>("/analyze-doc", async (req, reply) => {
  const { image, sessionId, type = "doc" } = req.body ?? {};
  if (!image || typeof image !== "string") {
    return reply.status(400).send({ error: "Missing image (base64 data URL)" });
  }
  try {
    const { score, url } = await analyzeDocQuality(image, sessionId, type);
    return { score, url };
  } catch (err) {
    req.log.error(err);
    return reply.status(500).send({ error: "Analysis failed" });
  }
});

// POST /compare-faces  { document: "...", selfie: "...", sessionId?: string }
app.post<{
  Body: { document: string; selfie: string; sessionId?: string };
}>("/compare-faces", async (req, reply) => {
  const { document, selfie, sessionId } = req.body ?? {};
  if (!document || !selfie || typeof document !== "string" || typeof selfie !== "string") {
    return reply.status(400).send({ error: "Missing document or selfie (base64)" });
  }
  try {
    const { score, url } = await compareFaces(document, selfie, sessionId);
    return { score, url };
  } catch (err) {
    req.log.error(err);
    return reply.status(500).send({ error: "Comparison failed" });
  }
});

// POST /analyze-liveness  { image: "data:image/jpeg;base64,...", sessionId?: string }
app.post<{ Body: { image: string; sessionId?: string } }>("/analyze-liveness", async (req, reply) => {
  const { image, sessionId } = req.body ?? {};
  if (!image || typeof image !== "string") {
    return reply.status(400).send({ error: "Missing image (base64 data URL)" });
  }
  try {
    const { score, url } = await analyzeLiveness(image, sessionId);
    return { score, url };
  } catch (err) {
    req.log.error(err);
    return reply.status(500).send({ error: "Liveness analysis failed" });
  }
});

// POST /verify - submit all images at once, run verification on server
app.post<{
  Body: {
    frontImg: string;
    backImg?: string;
    selfie: string;
    livenessImg: string;
    sessionId?: string;
  };
}>("/verify", async (req, reply) => {
  const { frontImg, backImg, selfie, livenessImg, sessionId } = req.body ?? {};
  if (!frontImg || !selfie || !livenessImg) {
    return reply.status(400).send({ error: "Missing frontImg, selfie, or livenessImg" });
  }
  try {
    const [docResult, backResult, faceResult, livenessResult] = await Promise.all([
      analyzeDocQuality(frontImg, sessionId, "doc"),
      backImg ? analyzeDocQuality(backImg, sessionId, "docBack") : Promise.resolve({ score: 85, url: "" }),
      compareFaces(frontImg, selfie, sessionId),
      analyzeLiveness(livenessImg, sessionId),
    ]);
    const docScore = backImg
      ? Math.round((docResult.score + backResult!.score) / 2)
      : docResult.score;
    const overall = Math.round(
      faceResult.score * 0.45 + livenessResult.score * 0.35 + docScore * 0.2
    );
    return {
      docScore,
      faceScore: faceResult.score,
      livenessScore: livenessResult.score,
      overall,
    };
  } catch (err) {
    req.log.error(err);
    return reply.status(500).send({ error: "Verification failed" });
  }
});

const port = Number(process.env.PORT) || 3001;
await app.listen({ port, host: "0.0.0.0" });
console.log(`KYC API running at http://localhost:${port}`);
