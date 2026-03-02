/**
 * KYC API client - calls kyc-api backend for face analysis
 */

const API_BASE = import.meta.env.VITE_KYC_API_URL || "/kyc-api";

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "API request failed");
  }
  return res.json();
}

export type CountryConfig = {
  code: string;
  name: string;
  flag: string;
  docs: string[];
};

/** Fetch countries & doc types from backend (no hardcoding) */
export async function fetchConfig(): Promise<{ countries: CountryConfig[] }> {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error("Failed to load config");
  return res.json();
}

/** No-op for compatibility - models load on backend */
export async function loadFaceApiModels(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

/** Document quality: send image to backend. Returns { score, url }. */
export async function analyzeDocQuality(
  imageUrl: string,
  sessionId?: string,
  type: "doc" | "docBack" = "doc"
): Promise<{ score: number; url: string }> {
  const res = await post<{ score: number; url: string }>("/analyze-doc", {
    image: imageUrl,
    ...(sessionId && { sessionId }),
    type,
  });
  return { score: res.score, url: res.url ?? "" };
}

/** Face match: send doc + selfie to backend. Returns { score, url }. */
export async function compareFaces(
  documentImageUrl: string,
  selfieImageUrl: string,
  sessionId?: string
): Promise<{ score: number; url: string }> {
  const res = await post<{ score: number; url: string }>("/compare-faces", {
    document: documentImageUrl,
    selfie: selfieImageUrl,
    ...(sessionId && { sessionId }),
  });
  return { score: res.score, url: res.url ?? "" };
}

/** Submit all images for verification. Returns scores. */
export async function verify(params: {
  frontImg: string;
  backImg?: string;
  selfie: string;
  livenessImg: string;
  sessionId?: string;
}): Promise<{ docScore: number; faceScore: number; livenessScore: number; overall: number }> {
  return post("/verify", params);
}

/** Liveness: capture frame from video, send to backend. Returns { score, url }. */
export async function analyzeLiveness(
  videoElement: HTMLVideoElement,
  sessionId?: string
): Promise<{ score: number; url: string }> {
  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { score: 70, url: "" };
  ctx.drawImage(videoElement, 0, 0);
  const imageUrl = canvas.toDataURL("image/jpeg", 0.9);

  const res = await post<{ score: number; url: string }>("/analyze-liveness", {
    image: imageUrl,
    ...(sessionId && { sessionId }),
  });
  return { score: res.score, url: res.url ?? "" };
}
