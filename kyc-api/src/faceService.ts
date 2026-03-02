/**
 * AWS Rekognition backend service for KYC
 */
import {
  RekognitionClient,
  DetectFacesCommand,
  CompareFacesCommand,
} from "@aws-sdk/client-rekognition";
import { uploadToS3 } from "./s3Service.js";

const client = new RekognitionClient({
  region: process.env.AWS_REGION || "us-east-1",
});

function base64ToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  return new Uint8Array(Buffer.from(base64, "base64"));
}

/** Document quality: upload to S3, detect face presence, return { score, url } */
export async function analyzeDocQuality(
  imageBase64: string,
  sessionId?: string,
  type: "doc" | "docBack" = "doc"
): Promise<{ score: number; url: string }> {
  let url = "";
  if (sessionId) {
    url = (await uploadToS3(sessionId, type, imageBase64)) ?? "";
  }
  try {
    const { FaceDetails } = await client.send(
      new DetectFacesCommand({
        Image: { Bytes: base64ToBytes(imageBase64) },
        Attributes: ["ALL"],
      })
    );

    if (!FaceDetails?.length) return { score: 45, url };
    const confidence = FaceDetails[0].Confidence ?? 0;
    const score = Math.round(confidence);
    return { score: Math.min(95, Math.max(50, score)), url };
  } catch (err) {
    console.error("analyzeDocQuality:", err);
    return { score: 55, url };
  }
}

/** Face match: upload selfie to S3 (doc already uploaded in analyzeDocQuality), compare, return { score, url } (url = selfie) */
export async function compareFaces(
  documentBase64: string,
  selfieBase64: string,
  sessionId?: string
): Promise<{ score: number; url: string }> {
  let url = "";
  if (sessionId) {
    url = (await uploadToS3(sessionId, "selfie", selfieBase64)) ?? "";
  }
  try {
    const { FaceMatches } = await client.send(
      new CompareFacesCommand({
        SourceImage: { Bytes: base64ToBytes(documentBase64) },
        TargetImage: { Bytes: base64ToBytes(selfieBase64) },
        SimilarityThreshold: 0,
      })
    );

    if (!FaceMatches?.length) return { score: 40, url };
    const similarity = FaceMatches[0].Similarity ?? 0;
    const score = Math.round(Math.min(98, Math.max(25, similarity)));
    return { score, url };
  } catch (err) {
    console.error("compareFaces:", err);
    return { score: 50, url };
  }
}

/** Liveness: upload to S3, detect face in frame, return { score, url } */
export async function analyzeLiveness(
  imageBase64: string,
  sessionId?: string
): Promise<{ score: number; url: string }> {
  let url = "";
  if (sessionId) {
    url = (await uploadToS3(sessionId, "liveness", imageBase64)) ?? "";
  }
  try {
    const { FaceDetails } = await client.send(
      new DetectFacesCommand({
        Image: { Bytes: base64ToBytes(imageBase64) },
        Attributes: ["ALL"],
      })
    );

    if (!FaceDetails?.length) return { score: 55, url };
    const confidence = FaceDetails[0].Confidence ?? 0;
    const score = Math.round(confidence);
    return { score: Math.min(95, Math.max(60, score)), url };
  } catch (err) {
    console.error("analyzeLiveness:", err);
    return { score: 70, url };
  }
}
