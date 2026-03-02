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

/** No-op for compatibility - models load on backend */
export async function loadFaceApiModels(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

/** Document quality: send image to backend */
export async function analyzeDocQuality(imageUrl: string): Promise<number> {
  const { score } = await post<{ score: number }>("/analyze-doc", {
    image: imageUrl,
  });
  return score;
}

/** Face match: send doc + selfie to backend */
export async function compareFaces(
  documentImageUrl: string,
  selfieImageUrl: string
): Promise<number> {
  const { score } = await post<{ score: number }>("/compare-faces", {
    document: documentImageUrl,
    selfie: selfieImageUrl,
  });
  return score;
}

/** Liveness: capture frame from video, send to backend */
export async function analyzeLiveness(videoElement: HTMLVideoElement): Promise<number> {
  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return 70;
  ctx.drawImage(videoElement, 0, 0);
  const imageUrl = canvas.toDataURL("image/jpeg", 0.9);

  const { score } = await post<{ score: number }>("/analyze-liveness", {
    image: imageUrl,
  });
  return score;
}
