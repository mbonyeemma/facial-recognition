import { useState, useRef, useEffect } from "react";
import {
  loadFaceApiModels,
  fetchConfig,
  analyzeDocQuality as faceApiDocQuality,
  compareFaces as faceApiCompareFaces,
  analyzeLiveness as faceApiLiveness,
} from "./faceApi";
import type { CountryConfig } from "./faceApi";

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Convert File to base64 data URL for API (must be data URL, not blob URL) */
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Failed to read file"));
    r.readAsDataURL(file);
  });
}
const calcScore = (f: number, l: number, d: number) =>
  Math.round(f * 0.45 + l * 0.35 + d * 0.2);

const verdict = (s: number) =>
  s >= 85
    ? { label: "VERIFIED", color: "#00d98b", glow: "#00d98b" }
    : s >= 65
      ? { label: "REVIEW", color: "#f5a623", glow: "#f5a623" }
      : { label: "FAILED", color: "#ff4560", glow: "#ff4560" };

/* ─── GLOBAL STYLES injected once ───────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Clash+Display:wght@500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
  html,body{height:100%;overflow-x:hidden;}
  body{background:#f8f9fa;font-family:'DM Mono',monospace;}
  ::-webkit-scrollbar{display:none;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  @keyframes scanline{0%{top:-8%}100%{top:108%}}
  @keyframes ringPop{0%{transform:scale(.7);opacity:0}60%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
  @keyframes shimmer{0%{background-position:-200%}100%{background-position:200%}}
  .fadeUp{animation:fadeUp .38s cubic-bezier(.22,1,.36,1) both;}
  .spin{animation:spin .9s linear infinite;}
  .pulse{animation:pulse 1.4s ease infinite;}
`;

/* ─── PRIMITIVE COMPONENTS ───────────────────────────────────────────────── */
const S = {
  screen: {
    minHeight: "100dvh",
    background: "#f8f9fa",
    display: "flex" as const,
    flexDirection: "column" as const,
    alignItems: "center",
    padding: "0 0 32px",
  },
  topBar: {
    width: "100%",
    padding: "18px 20px 12px",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  card: (extra: React.CSSProperties = {}) => ({
    width: "calc(100% - 32px)",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: "24px 20px",
    marginTop: 16,
    ...extra,
  }),
  label: {
    color: "#64748b",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: 500,
    marginBottom: 8,
    display: "block",
  },
  select: {
    width: "100%",
    background: "#fff",
    color: "#1a1a2e",
    border: "1.5px solid #e2e8f0",
    borderRadius: 14,
    padding: "16px 18px",
    fontSize: 16,
    fontFamily: "'DM Mono',monospace",
    appearance: "none" as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 16px center",
  },
  primaryBtn: (disabled = false) => ({
    width: "100%",
    padding: "18px",
    borderRadius: 16,
    background: disabled ? "#e2e8f0" : "linear-gradient(135deg,#5b6ef5,#7c3aed)",
    color: disabled ? "#94a3b8" : "#fff",
    fontSize: 16,
    fontWeight: 700,
    fontFamily: "'DM Mono',monospace",
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 8px 32px #5b6ef540",
    transition: "all .2s",
    letterSpacing: 0.5,
  }),
  ghostBtn: {
    width: "100%",
    padding: "16px",
    borderRadius: 16,
    background: "transparent",
    color: "#5b6ef5",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "'DM Mono',monospace",
    border: "1.5px solid #e2e8f0",
    cursor: "pointer",
  },
  pill: (active: boolean) => ({
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 16px",
    borderRadius: 50,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    border: active ? "1.5px solid #5b6ef5" : "1.5px solid #e2e8f0",
    background: active ? "#5b6ef518" : "transparent",
    color: active ? "#5b6ef5" : "#64748b",
    transition: "all .2s",
  }),
};

function TopBar({
  step,
  total,
  onBack,
}: {
  step: number;
  total: number;
  onBack: (() => void) | null;
}) {
  return (
    <div style={S.topBar}>
      {onBack && (
        <button
          onClick={onBack}
          style={{
            background: "#fff",
            border: "1.5px solid #e2e8f0",
            borderRadius: 12,
            width: 40,
            height: 40,
            color: "#5b6ef5",
            fontSize: 18,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          ‹
        </button>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ color: "#64748b", fontSize: 11, letterSpacing: 2 }}>
            STEP {step} / {total}
          </span>
          <span style={{ color: "#5b6ef5", fontSize: 11, letterSpacing: 1 }}>
            {Math.round((step / total) * 100)}%
          </span>
        </div>
        <div style={{ height: 3, background: "#e2e8f0", borderRadius: 2 }}>
          <div
            style={{
              height: "100%",
              borderRadius: 2,
              transition: "width .5s cubic-bezier(.22,1,.36,1)",
              width: `${(step / total) * 100}%`,
              background: "linear-gradient(90deg,#5b6ef5,#7c3aed)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <svg
      width="130"
      height="130"
      style={{ animation: "ringPop .6s cubic-bezier(.22,1,.36,1) both" }}
    >
      <circle cx="65" cy="65" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
      <circle
        cx="65"
        cy="65"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 65 65)"
        style={{
          filter: `drop-shadow(0 0 8px ${color})`,
          transition: "stroke-dashoffset 1s ease",
        }}
      />
      <text
        x="65"
        y="60"
        textAnchor="middle"
        fill="#1a1a2e"
        fontSize="26"
        fontWeight="700"
        fontFamily="'DM Mono',monospace"
      >
        {score}
      </text>
      <text
        x="65"
        y="78"
        textAnchor="middle"
        fill="#64748b"
        fontSize="11"
        fontFamily="'DM Mono',monospace"
      >
        / 100
      </text>
    </svg>
  );
}

/* ─── CAMERA CAPTURE OVERLAY (full-screen) ───────────────────────────────── */
function CameraOverlay({
  onCapture,
  onClose,
  hint,
  mode = "doc",
}: {
  onCapture: (url: string) => void;
  onClose: () => void;
  hint: string;
  mode?: "doc" | "selfie";
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | undefined;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: mode === "selfie" ? "user" : "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setReady(true);
        }
      } catch {
        setErr("Camera access denied. Please allow camera permission.");
      }
    })();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [mode]);

  function shoot() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
    onCapture(c.toDataURL("image/jpeg", 0.92));
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        zIndex: 999,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {flash && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#fff",
            zIndex: 10,
            opacity: 0.7,
          }}
        />
      )}

      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {mode === "doc" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ position: "absolute", inset: 0, background: "#000", opacity: 0.45 }} />
            <div
              style={{
                position: "relative",
                width: "88%",
                height: "56%",
                border: "2px solid rgba(91,110,245,.8)",
                borderRadius: 16,
                boxShadow: "0 0 0 9999px rgba(0,0,0,.45)",
              }}
            >
              {[
                ["top:0,left:0", "borderTop,borderLeft"],
                ["top:0,right:0", "borderTop,borderRight"],
                ["bottom:0,left:0", "borderBottom,borderLeft"],
                ["bottom:0,right:0", "borderBottom,borderRight"],
              ].map(([pos, borders], i) => {
                const p = Object.fromEntries(
                  (pos as string).split(",").map((x) => x.split(":") as [string, string])
                );
                const b = Object.fromEntries(
                  (borders as string).split(",").map((x) => [x, "3px solid #8b9cff"] as const)
                );
                return (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      width: 22,
                      height: 22,
                      ...p,
                      ...b,
                    } as React.CSSProperties}
                  />
                );
              })}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  height: 2,
                  background: "linear-gradient(90deg,transparent,#5b6ef5,transparent)",
                  animation: "scanline 2.2s ease-in-out infinite",
                }}
              />
            </div>
          </div>
        )}

        {mode === "selfie" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "75vw",
                height: "75vw",
                maxWidth: 320,
                maxHeight: 320,
                border: "2px solid rgba(91,110,245,.7)",
                borderRadius: "50%",
                boxShadow: "0 0 0 9999px rgba(0,0,0,.5)",
              }}
            />
          </div>
        )}

        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "20px 24px",
            textAlign: "center",
            background: "linear-gradient(transparent,#000)",
          }}
        >
          <p style={{ color: "#8b9cff", fontSize: 14, letterSpacing: 0.5 }}>{hint}</p>
        </div>

        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "rgba(0,0,0,.6)",
            border: "none",
            borderRadius: 50,
            width: 40,
            height: 40,
            color: "#fff",
            fontSize: 22,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>
      </div>

      <div
        style={{
          padding: "28px 0 40px",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {err ? (
          <p style={{ color: "#ff4560", fontSize: 14, textAlign: "center", padding: "0 24px" }}>
            {err}
          </p>
        ) : (
          <button
            onClick={shoot}
            disabled={!ready}
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: ready ? "#fff" : "#333",
              border: "5px solid rgba(255,255,255,.25)",
              cursor: ready ? "pointer" : "not-allowed",
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ─── STEP 1: Country & Document ─────────────────────────────────────────── */
const FALLBACK_COUNTRIES: CountryConfig[] = [
  { code: "UG", name: "Uganda", flag: "🇺🇬", docs: ["National ID", "Passport", "Driving Permit"] },
  { code: "KE", name: "Kenya", flag: "🇰🇪", docs: ["National ID", "Passport", "Driving Licence"] },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿", docs: ["National ID", "Passport", "Driving Licence"] },
];

function StepCountry({
  countries,
  onNext,
}: {
  countries: CountryConfig[];
  onNext: (d: Record<string, unknown>) => void;
}) {
  const [country, setCountry] = useState("");
  const [docType, setDocType] = useState("");
  const sel = countries.find((c) => c.code === country);

  return (
    <div
      className="fadeUp"
      style={{
        width: "100%",
        flex: 1,
        overflowY: "auto",
        padding: "0 16px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        paddingTop: 8,
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div style={S.card()}>
        <h2
          style={{
            color: "#1a1a2e",
            fontSize: 22,
            fontFamily: "'DM Mono',monospace",
            marginBottom: 4,
          }}
        >
          Let's verify you 👋
        </h2>
        <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
          We'll need your ID and a quick selfie. Takes about 2 minutes.
        </p>
      </div>

      <div style={S.card()}>
        <label style={S.label}>ISSUING COUNTRY</label>
        <div style={{ position: "relative" }}>
          <select
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setDocType("");
            }}
            style={S.select}
          >
            <option value="">Select country…</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {sel && (
        <div className="fadeUp" style={S.card()}>
          <label style={S.label}>DOCUMENT TYPE</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            style={S.select}
          >
            <option value="">Select document type…</option>
            {sel.docs.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        style={S.primaryBtn(!country || !docType)}
        disabled={!country || !docType}
        onClick={() =>
          onNext({
            country: sel,
            docType,
            sessionId: `kyc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          })
        }
      >
        Continue
      </button>
    </div>
  );
}

/* ─── STEP 2: Doc Front ──────────────────────────────────────────────────── */
function StepDocFront({
  data,
  onNext,
}: {
  data: { country: CountryConfig; docType: string; sessionId?: string };
  onNext: (d: Record<string, unknown>) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [img, setImg] = useState<string | null>(null);
  const [cam, setCam] = useState(false);
  const [quality, setQuality] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const needsBack = data.docType !== "Passport";

  async function analyze(url: string) {
    setLoading(true);
    setQuality(null);
    const { score } = await faceApiDocQuality(url, data.sessionId as string | undefined);
    setQuality(score);
    setLoading(false);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const dataUrl = await fileToDataUrl(f);
    setImg(dataUrl);
    analyze(dataUrl);
  }

  return (
    <div
      className="fadeUp"
      style={{
        width: "100%",
        flex: 1,
        overflowY: "auto",
        padding: "0 16px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        WebkitOverflowScrolling: "touch",
      }}
    >
      {cam && (
        <CameraOverlay
          mode="doc"
          hint="Align your document inside the frame"
          onCapture={(url) => {
            setImg(url);
            setCam(false);
            analyze(url);
          }}
          onClose={() => setCam(false)}
        />
      )}

      <div style={S.card()}>
        <p style={{ color: "#64748b", fontSize: 11, letterSpacing: 2, marginBottom: 4 }}>
          {data.country.flag} {data.country.name} · {data.docType}
        </p>
        <h2
          style={{ color: "#1a1a2e", fontSize: 20, fontFamily: "'DM Mono',monospace" }}
        >
          📄 Front of document
        </h2>
        <p style={{ color: "#64748b", fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>
          Make sure all text is clear and there's no glare or blur.
        </p>
      </div>

      <div
        onClick={() => !img && setCam(true)}
        style={{
          width: "calc(100% - 32px)",
          margin: "0 16px",
          height: 210,
          borderRadius: 20,
          overflow: "hidden",
          position: "relative",
          border: img ? "none" : "2px dashed #e2e8f0",
          background: img ? "transparent" : "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: img ? "default" : "pointer",
        }}
      >
        {img ? (
          <img src={img} alt="doc front" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🪪</div>
            <p style={{ color: "#64748b", fontSize: 14 }}>Tap to capture</p>
          </div>
        )}
        {quality && (
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              padding: "5px 12px",
              borderRadius: 50,
              background: quality >= 80 ? "#00d98b20" : "#f5a62320",
              border: `1px solid ${quality >= 80 ? "#00d98b60" : "#f5a62360"}`,
              color: quality >= 80 ? "#00d98b" : "#f5a623",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {quality >= 80 ? "✓ " : "⚠ "}
            {quality}/100
          </div>
        )}
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#f8f9facc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              className="spin"
              style={{
                width: 32,
                height: 32,
                border: "3px solid #e2e8f0",
                borderTopColor: "#5b6ef5",
                borderRadius: "50%",
              }}
            />
          </div>
        )}
      </div>

      {img && (
        <div style={{ display: "flex", gap: 10, padding: "0 16px" }}>
          <button onClick={() => setCam(true)} style={{ ...S.ghostBtn, flex: 1 }}>
            Retake
          </button>
          <label style={{ flex: 1, display: "flex" }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFile}
            />
            <button
              onClick={() => fileRef.current?.click()}
              style={{ ...S.ghostBtn, flex: 1 }}
            >
              Upload file
            </button>
          </label>
        </div>
      )}

      {!img && (
        <div style={{ display: "flex", gap: 10, padding: "0 0" }}>
          <button onClick={() => setCam(true)} style={S.primaryBtn()}>
            📷 Open Camera
          </button>
        </div>
      )}
      {!img && (
        <label style={{ display: "flex", padding: "0 0" }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFile}
          />
          <button onClick={() => fileRef.current?.click()} style={S.ghostBtn}>
            Or upload from gallery
          </button>
        </label>
      )}

      <button
        style={S.primaryBtn(!img || loading || !quality)}
        disabled={!img || loading || !quality}
        onClick={() => onNext({ frontImg: img, docScore: quality })}
      >
        {needsBack ? "Next: Back of document →" : "Continue →"}
      </button>
    </div>
  );
}

/* ─── STEP 3: Doc Back (conditional) ────────────────────────────────────── */
function StepDocBack({
  data,
  onNext,
}: {
  data: { docType: string; sessionId?: string };
  onNext: (d: Record<string, unknown>) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [img, setImg] = useState<string | null>(null);
  const [cam, setCam] = useState(false);
  const [qual, setQual] = useState<number | null>(null);
  const [load, setLoad] = useState(false);

  async function analyze(url: string) {
    setLoad(true);
    setQual(null);
    const { score } = await faceApiDocQuality(url, data.sessionId as string | undefined, "docBack");
    setQual(score);
    setLoad(false);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const dataUrl = await fileToDataUrl(f);
    setImg(dataUrl);
    analyze(dataUrl);
  }

  return (
    <div
      className="fadeUp"
      style={{
        width: "100%",
        flex: 1,
        overflowY: "auto",
        padding: "0 16px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        WebkitOverflowScrolling: "touch",
      }}
    >
      {cam && (
        <CameraOverlay
          mode="doc"
          hint="Capture the back of your document"
          onCapture={(url) => {
            setImg(url);
            setCam(false);
            analyze(url);
          }}
          onClose={() => setCam(false)}
        />
      )}

      <div style={S.card()}>
        <h2
          style={{ color: "#1a1a2e", fontSize: 20, fontFamily: "'DM Mono',monospace" }}
        >
          🔄 Back of document
        </h2>
        <p style={{ color: "#64748b", fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>
          Flip your {data.docType} and capture the back side.
        </p>
      </div>

      <div
        onClick={() => !img && setCam(true)}
        style={{
          width: "calc(100% - 0px)",
          height: 210,
          borderRadius: 20,
          overflow: "hidden",
          position: "relative",
          border: img ? "none" : "2px dashed #e2e8f0",
          background: img ? "transparent" : "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: img ? "default" : "pointer",
        }}
      >
        {img ? (
          <img src={img} alt="doc back" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🔄</div>
            <p style={{ color: "#64748b", fontSize: 14 }}>Tap to capture</p>
          </div>
        )}
        {qual && (
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              padding: "5px 12px",
              borderRadius: 50,
              background: qual >= 80 ? "#00d98b20" : "#f5a62320",
              border: `1px solid ${qual >= 80 ? "#00d98b60" : "#f5a62360"}`,
              color: qual >= 80 ? "#00d98b" : "#f5a623",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {qual >= 80 ? "✓ " : "⚠ "}
            {qual}/100
          </div>
        )}
        {load && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#f8f9facc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              className="spin"
              style={{
                width: 32,
                height: 32,
                border: "3px solid #e2e8f0",
                borderTopColor: "#5b6ef5",
                borderRadius: "50%",
              }}
            />
          </div>
        )}
      </div>

      {img && (
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setCam(true)} style={{ ...S.ghostBtn, flex: 1 }}>
            Retake
          </button>
          <label style={{ flex: 1, display: "flex" }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFile}
            />
            <button
              onClick={() => fileRef.current?.click()}
              style={{ ...S.ghostBtn, flex: 1 }}
            >
              Upload
            </button>
          </label>
        </div>
      )}

      {!img && (
        <>
          <button onClick={() => setCam(true)} style={S.primaryBtn()}>
            📷 Open Camera
          </button>
          <label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFile}
            />
            <button onClick={() => fileRef.current?.click()} style={S.ghostBtn}>
              Or upload from gallery
            </button>
          </label>
        </>
      )}

      <button
        style={S.primaryBtn(!img || load || !qual)}
        disabled={!img || load || !qual}
        onClick={() => onNext({ backImg: img })}
      >
        Continue →
      </button>
    </div>
  );
}

/* ─── STEP 4: Selfie ─────────────────────────────────────────────────────── */
function StepSelfie({
  data,
  onNext,
}: {
  data: { docType: string; frontImg?: string; sessionId?: string };
  onNext: (d: Record<string, unknown>) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [cam, setCam] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function compare(selfieUrl: string) {
    setLoading(true);
    setScore(null);
    const docUrl = data.frontImg;
    const result = docUrl
      ? await faceApiCompareFaces(docUrl, selfieUrl, data.sessionId as string | undefined)
      : { score: 75, url: "" };
    setScore(result.score);
    setLoading(false);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const dataUrl = await fileToDataUrl(f);
    setSelfie(dataUrl);
    compare(dataUrl);
  }

  return (
    <div
      className="fadeUp"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {cam && (
        <CameraOverlay
          mode="selfie"
          hint="Center your face inside the circle"
          onCapture={(url) => {
            setSelfie(url);
            setCam(false);
            compare(url);
          }}
          onClose={() => setCam(false)}
        />
      )}

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 16px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={S.card()}>
          <h2
            style={{ color: "#1a1a2e", fontSize: 20, fontFamily: "'DM Mono',monospace" }}
          >
            🤳 Take your selfie
          </h2>
          <p style={{ color: "#64748b", fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>
            We'll compare your face to your {data.docType}. Look directly at the camera with
            good lighting.
          </p>
        </div>

        <div
          style={{
            width: selfie ? "100%" : "75vw",
            aspectRatio: "1/1",
            maxHeight: 220,
            borderRadius: selfie ? 20 : "50%",
          overflow: "hidden",
          position: "relative",
          margin: "0 auto",
          border: selfie ? "none" : "2px dashed #e2e8f0",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: selfie ? "default" : "pointer",
          transition: "all .4s cubic-bezier(.22,1,.36,1)",
        }}
        onClick={() => !selfie && setCam(true)}
      >
        {selfie ? (
          <img
            src={selfie}
            alt="selfie"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 42, marginBottom: 8 }}>👤</div>
            <p style={{ color: "#64748b", fontSize: 13 }}>Tap to open camera</p>
          </div>
        )}
        {score && (
          <div
            style={{
              position: "absolute",
              bottom: 14,
              left: "50%",
              transform: "translateX(-50%)",
              padding: "6px 18px",
              borderRadius: 50,
              whiteSpace: "nowrap",
              background: score >= 75 ? "#00d98b20" : "#ff456020",
              border: `1px solid ${score >= 75 ? "#00d98b60" : "#ff456060"}`,
              color: score >= 75 ? "#00d98b" : "#ff4560",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {score >= 75 ? "✓ " : "⚠ "} Face match: {score}/100
          </div>
        )}
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#f8f9facc",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <div
              className="spin"
              style={{
                width: 36,
                height: 36,
                border: "3px solid #e2e8f0",
                borderTopColor: "#5b6ef5",
                borderRadius: "50%",
              }}
            />
            <p style={{ color: "#5b6ef5", fontSize: 13 }}>Comparing with ID…</p>
          </div>
        )}
        </div>

        {selfie && (
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <button onClick={() => setSelfie(null)} style={{ ...S.ghostBtn, flex: 1 }}>
              Retake
            </button>
            <label style={{ flex: 1, display: "flex" }}>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFile}
              />
              <button
                onClick={() => fileRef.current?.click()}
                style={{ ...S.ghostBtn, flex: 1 }}
              >
                Upload
              </button>
            </label>
          </div>
        )}

        {!selfie && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
            <button onClick={() => setCam(true)} style={{ ...S.primaryBtn() }}>
              📷 Take Selfie
            </button>
            <label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFile}
              />
              <button onClick={() => fileRef.current?.click()} style={S.ghostBtn}>
                Or upload from gallery
              </button>
            </label>
          </div>
        )}
      </div>

      {/* Sticky bottom bar - always visible on mobile */}
      <div
        style={{
          flexShrink: 0,
          padding: "16px 16px max(16px, env(safe-area-inset-bottom))",
          background: "#f8f9fa",
          borderTop: "1px solid #e2e8f0",
        }}
      >
        <button
          style={S.primaryBtn(!selfie || loading || !score)}
          disabled={!selfie || loading || !score}
          onClick={() => onNext({ selfie, faceScore: score })}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

/* ─── STEP 5: Liveness ───────────────────────────────────────────────────── */
const LIVENESS_DURATION = 8;

function StepLiveness({
  data,
  onNext,
}: {
  data: { sessionId?: string };
  onNext: (d: Record<string, unknown>) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [phase, setPhase] = useState<"intro" | "running" | "analyzing" | "done">("intro");
  const [secs, setSecs] = useState(LIVENESS_DURATION);
  const [lScore, setLScore] = useState<number | null>(null);
  const [camErr, setCamErr] = useState(false);

  useEffect(() => {
    if (phase !== "running") return;
    let cancelled = false;
    (async () => {
      for (let s = LIVENESS_DURATION; s > 0; s--) {
        if (cancelled) return;
        setSecs(s);
        await sleep(1000);
      }
      if (cancelled) return;
      setPhase("analyzing");
      const video = videoRef.current;
      const result = video ? await faceApiLiveness(video, data.sessionId) : { score: 75, url: "" };
      if (cancelled) return;
      setLScore(result.score);
      setPhase("done");
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, data.sessionId]);

  async function startCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
      setSecs(LIVENESS_DURATION);
      setPhase("running");
    } catch {
      setCamErr(true);
    }
  }

  useEffect(() => {
    if (stream && videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(
    () => () => stream?.getTracks().forEach((t) => t.stop()),
    [stream]
  );

  const r = 54;
  const c = 2 * Math.PI * r;
  const progress = phase === "running" ? (LIVENESS_DURATION - secs) / LIVENESS_DURATION : 1;
  const strokeOffset = c - progress * c;

  return (
    <div
      className="fadeUp"
      style={{
        width: "100%",
        flex: 1,
        overflowY: "auto",
        padding: "0 16px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        WebkitOverflowScrolling: "touch",
      }}
    >
      {phase === "intro" && (
        <>
          <div style={S.card()}>
            <h2
              style={{
                color: "#1a1a2e",
                fontSize: 20,
                fontFamily: "'DM Mono',monospace",
              }}
            >
              👁️ Liveness check
            </h2>
            <p style={{ color: "#64748b", fontSize: 13, marginTop: 6, lineHeight: 1.7 }}>
              We need to confirm you're a real person. Look at the camera for 8 seconds.
            </p>
          </div>
          {camErr && (
            <p style={{ color: "#ff4560", fontSize: 13, textAlign: "center" }}>
              Camera unavailable. Please allow camera access.
            </p>
          )}
          <button onClick={startCamera} style={S.primaryBtn()}>
            ▶ Start
          </button>
        </>
      )}

      {(phase === "running" || phase === "analyzing") && (
        <>
          <div
            style={{
              width: "100%",
              height: 300,
              borderRadius: 20,
              overflow: "hidden",
              position: "relative",
              background: "#000",
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "60%",
                  height: "86%",
                  border: "2px solid rgba(91,110,245,.8)",
                  borderRadius: "50%",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,.45)",
                }}
              />
            </div>
            {phase === "running" && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 120,
                  height: 120,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="120"
                  height="120"
                  style={{
                    position: "absolute",
                    transform: "rotate(-90deg)",
                  }}
                >
                  <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
                  <circle
                    cx="60"
                    cy="60"
                    r={r}
                    fill="none"
                    stroke="#5b6ef5"
                    strokeWidth="6"
                    strokeDasharray={c}
                    strokeDashoffset={strokeOffset}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                  />
                </svg>
                <span
                  style={{
                    position: "relative",
                    zIndex: 1,
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 28,
                    fontFamily: "'DM Mono',monospace",
                    textShadow: "0 1px 4px rgba(0,0,0,.5)",
                  }}
                >
                  {secs}
                </span>
              </div>
            )}
            {phase === "analyzing" && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "#f8f9facc",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  className="spin"
                  style={{
                    width: 40,
                    height: 40,
                    border: "3px solid #e2e8f0",
                    borderTopColor: "#5b6ef5",
                    borderRadius: "50%",
                  }}
                />
                <p style={{ color: "#5b6ef5", fontSize: 14 }}>Analyzing liveness…</p>
              </div>
            )}
          </div>
        </>
      )}

      {phase === "done" && lScore !== null && (
        <>
          <div style={{ textAlign: "center", padding: "20px 0 8px" }}>
            <ScoreRing score={lScore} color={lScore >= 75 ? "#00d98b" : "#f5a623"} />
            <p style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>LIVENESS SCORE</p>
          </div>
          <button
            style={S.primaryBtn()}
            onClick={() => onNext({ livenessScore: lScore })}
          >
            Continue →
          </button>
        </>
      )}
    </div>
  );
}

/* ─── STEP 6: Result ─────────────────────────────────────────────────────── */
function StepResult({
  data,
}: {
  data: {
    country: CountryConfig;
    docType: string;
    faceScore: number;
    livenessScore: number;
    docScore: number;
  };
}) {
  const overall = calcScore(data.faceScore, data.livenessScore, data.docScore);
  const v = verdict(overall);
  const id = "KYC-" + Date.now().toString(36).toUpperCase();

  const rows = [
    { label: "Face match", score: data.faceScore, weight: "45%" },
    { label: "Liveness", score: data.livenessScore, weight: "35%" },
    { label: "Document quality", score: data.docScore, weight: "20%" },
  ];

  return (
    <div
      className="fadeUp"
      style={{
        width: "100%",
        padding: "0 16px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ textAlign: "center", padding: "24px 0 8px" }}>
        <ScoreRing score={overall} color={v.color} />
        <div
          style={{
            display: "inline-block",
            marginTop: 12,
            padding: "7px 24px",
            borderRadius: 50,
            background: v.color + "18",
            border: `1.5px solid ${v.color}50`,
            color: v.color,
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: 3,
          }}
        >
          {v.label}
        </div>
        <p style={{ color: "#64748b", fontSize: 11, marginTop: 8, letterSpacing: 1 }}>{id}</p>
      </div>

      <div style={S.card()}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1, padding: "10px 12px", background: "#f1f5f9", borderRadius: 10 }}>
            <p style={{ ...S.label, marginBottom: 4 }}>COUNTRY</p>
            <p style={{ color: "#1a1a2e", fontSize: 14 }}>
              {data.country.flag} {data.country.name}
            </p>
          </div>
          <div style={{ flex: 1, padding: "10px 12px", background: "#f1f5f9", borderRadius: 10 }}>
            <p style={{ ...S.label, marginBottom: 4 }}>DOCUMENT</p>
            <p style={{ color: "#1a1a2e", fontSize: 14 }}>🪪 {data.docType}</p>
          </div>
        </div>

        {rows.map((r) => (
          <div key={r.label} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: "#64748b", fontSize: 12 }}>
                {r.label}{" "}
                <span style={{ color: "#94a3b8" }}>({r.weight})</span>
              </span>
              <span
                style={{
                  color: r.score >= 75 ? "#00d98b" : "#f5a623",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {r.score}/100
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "#e2e8f0" }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: 3,
                  transition: "width 1.2s ease",
                  width: `${r.score}%`,
                  background:
                    r.score >= 75
                      ? "linear-gradient(90deg,#5b6ef5,#00d98b)"
                      : "linear-gradient(90deg,#f5a623,#ff6b35)",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: "16px 18px",
          borderRadius: 14,
          background: v.color + "10",
          border: `1px solid ${v.color}30`,
          color: "#64748b",
          fontSize: 13,
          lineHeight: 1.7,
        }}
      >
        {overall >= 85 &&
          "✅ Identity successfully verified. All biometric and document checks passed. You may proceed."}
        {overall >= 65 &&
          overall < 85 &&
          "⚠️ Verification needs manual review. Some checks returned borderline results. A compliance officer will review within 24 hours."}
        {overall < 65 &&
          "❌ Verification failed. One or more checks did not meet the minimum threshold. Please retry with better lighting and a clearer document."}
      </div>

      <button
        style={S.primaryBtn()}
        onClick={() => {
          const report = {
            verificationId: id,
            overall,
            verdict: v.label,
            ...data,
            country: data.country.name,
            timestamp: new Date().toISOString(),
          };
          const a = document.createElement("a");
          a.href = URL.createObjectURL(
            new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })
          );
          a.download = `${id}.json`;
          a.click();
        }}
      >
        ⬇ Download Report
      </button>

      <button style={S.ghostBtn} onClick={() => window.location.reload()}>
        Start new verification
      </button>
    </div>
  );
}

/* ─── MAIN ───────────────────────────────────────────────────────────────── */
export default function App() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [countries, setCountries] = useState<CountryConfig[]>(FALLBACK_COUNTRIES);

  useEffect(() => {
    loadFaceApiModels();
  }, []);

  useEffect(() => {
    fetchConfig()
      .then((c) => setCountries(c.countries))
      .catch(() => {});
  }, []);
  const needsBack = Boolean(data.docType && data.docType !== "Passport");
  const TOTAL = needsBack ? 6 : 5;

  const stepLabel: string[] = [
    "Country & Doc",
    "Document Front",
    "Document Back",
    "Your Selfie",
    "Liveness Check",
    "KYC Result",
  ];

  function advance(extra: Record<string, unknown> = {}) {
    setData((p) => ({ ...p, ...extra }));
    setStep((p) => p + 1);
  }
  function back() {
    setStep((p) => Math.max(1, p - 1));
  }

  const showBack = step > 1 && step < (needsBack ? 6 : 5);

  return (
    <>
      <style>{CSS}</style>
      <div style={{ ...S.screen }}>
        <div
          style={{
            width: "100%",
            padding: "14px 20px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: "linear-gradient(135deg,#5b6ef5,#7c3aed)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                boxShadow: "0 4px 16px #5b6ef550",
              }}
            >
              🔐
            </div>
            <span
              style={{
                color: "#1a1a2e",
                fontWeight: 800,
                fontSize: 15,
                letterSpacing: 1,
              }}
            >
              VerifyID
            </span>
          </div>
          <span style={{ color: "#64748b", fontSize: 11, letterSpacing: 2 }}>
            {data.country && typeof data.country === "object" && "flag" in data.country && "code" in data.country
              ? `${(data.country as { flag: string; code: string }).flag} ${(data.country as { flag: string; code: string }).code}`
              : "KYC"}
          </span>
        </div>

        <TopBar step={step} total={TOTAL} onBack={showBack ? back : null} />

        <div style={{ width: "100%", padding: "0 20px 12px", flexShrink: 0 }}>
          <p style={{ color: "#64748b", fontSize: 11, letterSpacing: 2 }}>
            {String(stepLabel[step - 1] ?? "").toUpperCase()}
          </p>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", width: "100%" }}>
          {step === 1 && <StepCountry countries={countries} onNext={(d) => advance(d)} />}
        {step === 2 && <StepDocFront data={data as { country: CountryConfig; docType: string; sessionId?: string }} onNext={(d) => advance(d)} />}
        {step === 3 && needsBack && (
          <StepDocBack data={data as { docType: string; sessionId?: string }} onNext={(d) => advance(d)} />
        )}
        {step === (needsBack ? 4 : 3) && (
          <StepSelfie data={data as { docType: string; frontImg?: string; sessionId?: string }} onNext={(d) => advance(d)} />
        )}
        {step === (needsBack ? 5 : 4) && (
          <StepLiveness data={data as { sessionId?: string }} onNext={(d) => advance(d)} />
        )}
        {step === (needsBack ? 6 : 5) && (
          <StepResult
            data={data as {
              country: CountryConfig;
              docType: string;
              faceScore: number;
              livenessScore: number;
              docScore: number;
            }}
          />
        )}
        </div>
      </div>
    </>
  );
}
