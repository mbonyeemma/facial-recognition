import { useState, useRef, useEffect } from "react";
import { loadFaceApiModels, fetchConfig, verify as faceApiVerify } from "./faceApi";
import type { CountryConfig } from "./faceApi";

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
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
    ? { label: "Identity Verified", color: "#10B981", bg: "#D1FAE5" }
    : s >= 65
    ? { label: "Under Review", color: "#F59E0B", bg: "#FEF3C7" }
    : { label: "Verification Failed", color: "#EF4444", bg: "#FEE2E2" };

/* ─── GLOBAL STYLES ──────────────────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
  html,body,#root{height:100%;overflow-x:hidden;}
  body{background:#fff;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;}
  ::-webkit-scrollbar{display:none;}
  select{-webkit-appearance:none;appearance:none;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes scanline{0%{top:-8%}100%{top:108%}}
  @keyframes drawCheck{from{stroke-dashoffset:60}to{stroke-dashoffset:0}}
  @keyframes scaleIn{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}
  @keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
  .fadeUp{animation:fadeUp .3s cubic-bezier(.22,1,.36,1) both;}
  .spin{animation:spin .8s linear infinite;}
  .scaleIn{animation:scaleIn .4s cubic-bezier(.22,1,.36,1) both;}
  .slideUp{animation:slideUp .35s cubic-bezier(.22,1,.36,1) both;}
`;

/* ─── DESIGN TOKENS ──────────────────────────────────────────────────────── */
const C = {
  bg: "#fff",
  surface: "#F9FAFB",
  border: "#E5E7EB",
  brand: "#FFEC00",
  brandDark: "#E6D400",
  text: "#111827",
  textSub: "#6B7280",
  textMuted: "#9CA3AF",
  success: "#10B981",
  successBg: "#D1FAE5",
  error: "#EF4444",
  errorBg: "#FEE2E2",
  warn: "#F59E0B",
  warnBg: "#FEF3C7",
};

const T = {
  primaryBtn: (disabled = false): React.CSSProperties => ({
    width: "100%",
    padding: "15px 24px",
    borderRadius: 14,
    background: disabled ? C.border : C.text,
    color: disabled ? C.textMuted : "#fff",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "inherit",
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "opacity .15s",
    letterSpacing: "-.01em",
  }),
  ghostBtn: (danger = false): React.CSSProperties => ({
    width: "100%",
    padding: "15px 24px",
    borderRadius: 14,
    background: "transparent",
    color: danger ? C.error : C.text,
    fontSize: 15,
    fontWeight: 500,
    fontFamily: "inherit",
    border: `1.5px solid ${danger ? C.error : C.border}`,
    cursor: "pointer",
  }),
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: C.textSub,
    letterSpacing: ".04em",
    textTransform: "uppercase" as const,
    marginBottom: 8,
    display: "block",
  },
  select: {
    width: "100%",
    background: C.bg,
    color: C.text,
    border: `1.5px solid ${C.border}`,
    borderRadius: 12,
    padding: "14px 44px 14px 16px",
    fontSize: 15,
    fontFamily: "inherit",
    fontWeight: 500,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 14px center",
    cursor: "pointer",
  },
};

/* ─── ICONS (inline SVG) ─────────────────────────────────────────────────── */
const Icon = {
  back: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  ),
  card: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="3" ry="3" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  passport: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="2" width="18" height="20" rx="3" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7 20c0-2.8 2.2-5 5-5s5 2.2 5 5" />
    </svg>
  ),
  license: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="3" />
      <circle cx="8" cy="11" r="2.5" />
      <line x1="12.5" y1="9" x2="19" y2="9" />
      <line x1="12.5" y1="13" x2="17" y2="13" />
    </svg>
  ),
  camera: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  upload: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  ),
  trash: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  ),
  check: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  checkCircle: (color = "#10B981") => (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
      <circle cx="36" cy="36" r="36" fill={color + "22"} />
      <circle cx="36" cy="36" r="28" fill={color + "33"} />
      <circle cx="36" cy="36" r="20" fill={color} />
      <polyline points="26,36 33,43 46,29" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 60, animation: "drawCheck .4s .2s ease both" }} />
    </svg>
  ),
  xCircle: (color = "#EF4444") => (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className="scaleIn">
      <circle cx="36" cy="36" r="36" fill={color + "22"} />
      <circle cx="36" cy="36" r="28" fill={color + "33"} />
      <circle cx="36" cy="36" r="20" fill={color} />
      <line x1="27" y1="27" x2="45" y2="45" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <line x1="45" y1="27" x2="27" y2="45" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
  reviewCircle: (color = "#F59E0B") => (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className="scaleIn">
      <circle cx="36" cy="36" r="36" fill={color + "22"} />
      <circle cx="36" cy="36" r="28" fill={color + "33"} />
      <circle cx="36" cy="36" r="20" fill={color} />
      <text x="36" y="44" textAnchor="middle" fill="#fff" fontSize="26" fontWeight="700" fontFamily="inherit">!</text>
    </svg>
  ),
};

/* ─── TIP CHIP ────────────────────────────────────────────────────────────── */
function TipChip({ text }: { text: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 10px",
        borderRadius: 20,
        background: C.surface,
        border: `1px solid ${C.border}`,
        fontSize: 12,
        color: C.textSub,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: C.success, fontWeight: 700 }}>✓</span> {text}
    </span>
  );
}

/* ─── HEADER ─────────────────────────────────────────────────────────────── */
function Header({
  step,
  total,
  onBack,
  country,
}: {
  step: number;
  total: number;
  onBack: (() => void) | null;
  country?: string;
}) {
  const pct = Math.round((step / total) * 100);
  return (
    <div style={{ width: "100%", background: C.bg, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 56,
          padding: "0 20px",
          gap: 12,
        }}
      >
        {onBack ? (
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: C.text,
              display: "flex",
              alignItems: "center",
              padding: "4px 0",
              flexShrink: 0,
            }}
          >
            {Icon.back}
          </button>
        ) : (
          <div style={{ width: 24 }} />
        )}
        <div style={{ flex: 1, textAlign: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: C.text, letterSpacing: "-.02em" }}>VerifyID</span>
        </div>
        <div style={{ width: 24, textAlign: "right" }}>
          {country && <span style={{ fontSize: 11, color: C.textMuted }}>{country}</span>}
        </div>
      </div>
      <div style={{ height: 3, background: C.surface }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: C.brand,
            borderRadius: "0 2px 2px 0",
            transition: "width .4s cubic-bezier(.22,1,.36,1)",
          }}
        />
      </div>
    </div>
  );
}

/* ─── PINNED BOTTOM BAR ───────────────────────────────────────────────────── */
function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flexShrink: 0,
        padding: `16px 20px max(20px, env(safe-area-inset-bottom))`,
        background: C.bg,
        borderTop: `1px solid ${C.border}`,
      }}
    >
      {children}
    </div>
  );
}

/* ─── STEP HEADING ────────────────────────────────────────────────────────── */
function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: "-.03em", marginBottom: subtitle ? 6 : 0 }}>
        {title}
      </h2>
      {subtitle && <p style={{ fontSize: 14, color: C.textSub, lineHeight: 1.5 }}>{subtitle}</p>}
    </div>
  );
}

/* ─── CAMERA OVERLAY (full-screen) ───────────────────────────────────────── */
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
    setTimeout(() => setFlash(false), 150);
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
        <div style={{ position: "absolute", inset: 0, background: "#fff", zIndex: 10, opacity: 0.6, pointerEvents: "none" }} />
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
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                position: "relative",
                width: "88%",
                height: "56%",
                borderRadius: 14,
                boxShadow: "0 0 0 9999px rgba(0,0,0,.55)",
                border: `2px solid ${C.brand}`,
              }}
            >
              {([["top:0,left:0", "borderTop,borderLeft"], ["top:0,right:0", "borderTop,borderRight"], ["bottom:0,left:0", "borderBottom,borderLeft"], ["bottom:0,right:0", "borderBottom,borderRight"]] as const).map(([pos, borders], i) => {
                const p = Object.fromEntries((pos as string).split(",").map((x) => x.split(":") as [string, string]));
                const b = Object.fromEntries((borders as string).split(",").map((x) => [x, `3px solid ${C.brand}`] as const));
                return <div key={i} style={{ position: "absolute", width: 22, height: 22, ...p, ...b } as React.CSSProperties} />;
              })}
              <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${C.brand},transparent)`, animation: "scanline 2.2s ease-in-out infinite" }} />
            </div>
          </div>
        )}

        {mode === "selfie" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                width: "72vw",
                height: "90vw",
                maxWidth: 300,
                maxHeight: 375,
                border: `2.5px solid ${C.brand}`,
                borderRadius: "50%",
                boxShadow: "0 0 0 9999px rgba(0,0,0,.55)",
              }}
            />
          </div>
        )}

        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "24px 24px 20px", textAlign: "center", background: "linear-gradient(transparent,rgba(0,0,0,.7))" }}>
          <p style={{ color: "#fff", fontSize: 14, fontWeight: 500 }}>{hint}</p>
        </div>
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "rgba(0,0,0,.5)",
            border: "none",
            borderRadius: "50%",
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
      <div style={{ padding: "28px 0 44px", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {err ? (
          <p style={{ color: "#EF4444", fontSize: 14, textAlign: "center", padding: "0 24px" }}>{err}</p>
        ) : (
          <button
            onClick={shoot}
            disabled={!ready}
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: ready ? "#fff" : "#333",
              border: `5px solid rgba(255,255,255,.25)`,
              cursor: ready ? "pointer" : "not-allowed",
              transition: "background .2s",
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ─── FALLBACK DATA ───────────────────────────────────────────────────────── */
const FALLBACK_COUNTRIES: CountryConfig[] = [
  { code: "UG", name: "Uganda", flag: "🇺🇬", docs: ["National ID", "Passport", "Driving Permit"] },
  { code: "KE", name: "Kenya", flag: "🇰🇪", docs: ["National ID", "Passport", "Driving Licence"] },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿", docs: ["National ID", "Passport", "Driving Licence"] },
];

const DOC_ICONS: Record<string, React.ReactNode> = {
  "National ID": Icon.card,
  "Passport": Icon.passport,
  "Driving Permit": Icon.license,
  "Driving Licence": Icon.license,
};

/* ─── STEP 1: Country & Document ─────────────────────────────────────────── */
function StepCountryDoc({
  countries,
  onNext,
}: {
  countries: CountryConfig[];
  onNext: (d: Record<string, unknown>) => void;
}) {
  const [countryCode, setCountryCode] = useState("");
  const [docType, setDocType] = useState("");
  const sel = countries.find((c) => c.code === countryCode) ?? null;

  return (
    <div className="fadeUp" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 20px 16px", WebkitOverflowScrolling: "touch" }}>
        <StepHeading title="Select document" subtitle="Please select your KYC document" />

        <div style={{ marginBottom: 20 }}>
          <label style={T.label}>Country</label>
          <select
            value={countryCode}
            onChange={(e) => { setCountryCode(e.target.value); setDocType(""); }}
            style={T.select}
          >
            <option value="">Select country…</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
            ))}
          </select>
        </div>

        {sel && (
          <div className="fadeUp">
            <label style={T.label}>Document type</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sel.docs.map((d) => {
                const active = docType === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDocType(d)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      padding: "16px",
                      borderRadius: 14,
                      border: `2px solid ${active ? C.brand : C.border}`,
                      background: active ? "#FFFDE7" : C.bg,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "border-color .15s, background .15s",
                    }}
                  >
                    <span style={{ color: active ? C.text : C.textSub, flexShrink: 0 }}>
                      {DOC_ICONS[d] ?? Icon.card}
                    </span>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 15, color: C.text }}>{d}</span>
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        border: `2px solid ${active ? C.brand : C.border}`,
                        background: active ? C.brand : "transparent",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {active && <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.text, display: "block" }} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <BottomBar>
        <button
          style={T.primaryBtn(!countryCode || !docType)}
          disabled={!countryCode || !docType}
          onClick={() =>
            sel && onNext({
              country: sel,
              docType,
              sessionId: `kyc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            })
          }
        >
          Continue
        </button>
      </BottomBar>
    </div>
  );
}

/* ─── CAPTURE PLACEHOLDER ────────────────────────────────────────────────── */
function CapturePlaceholder({
  img,
  mode,
  onTap,
  onDelete,
  aspect = "doc",
}: {
  img: string | null;
  mode?: "doc" | "selfie";
  onTap: () => void;
  onDelete: () => void;
  aspect?: "doc" | "selfie";
}) {
  const docStyle: React.CSSProperties = {
    width: "100%",
    height: 220,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    border: img ? "none" : `2px dashed ${C.border}`,
    background: img ? "transparent" : C.surface,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: img ? "default" : "pointer",
  };
  const selfieStyle: React.CSSProperties = {
    width: 200,
    height: 200,
    borderRadius: "50%",
    overflow: "hidden",
    position: "relative",
    border: img ? `3px solid ${C.border}` : `2px dashed ${C.border}`,
    background: img ? "transparent" : C.surface,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: img ? "default" : "pointer",
    margin: "0 auto",
  };
  const style = aspect === "selfie" ? selfieStyle : docStyle;

  return (
    <div style={style} onClick={!img ? onTap : undefined}>
      {img ? (
        <>
          <img src={img} alt="capture" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "rgba(0,0,0,.55)",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Delete"
          >
            {Icon.trash}
          </button>
        </>
      ) : (
        <div style={{ textAlign: "center", color: C.textMuted }}>
          <div style={{ marginBottom: 8 }}>{Icon.camera}</div>
          <p style={{ fontSize: 13, fontWeight: 500 }}>Tap to capture</p>
        </div>
      )}
    </div>
  );
}

/* ─── CAPTURE ACTIONS ────────────────────────────────────────────────────── */
function CaptureActions({
  img,
  fileRef,
  onCamera,
  onFile,
  nextLabel,
  onNext,
  nextDisabled,
}: {
  img: string | null;
  fileRef: React.RefObject<HTMLInputElement>;
  onCamera: () => void;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  nextLabel: string;
  onNext: () => void;
  nextDisabled: boolean;
}) {
  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onFile}
      />
      {!img && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={onCamera} style={T.primaryBtn()}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              {Icon.camera} Open Camera
            </span>
          </button>
          <button onClick={() => fileRef.current?.click()} style={T.ghostBtn()}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              {Icon.upload} Upload from gallery
            </span>
          </button>
        </div>
      )}
      {img && (
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCamera} style={{ ...T.ghostBtn(), flex: 1, padding: "13px" }}>
            Retake
          </button>
          <button onClick={() => fileRef.current?.click()} style={{ ...T.ghostBtn(), flex: 1, padding: "13px" }}>
            Upload
          </button>
        </div>
      )}
      <button style={T.primaryBtn(nextDisabled)} disabled={nextDisabled} onClick={onNext}>
        {nextLabel}
      </button>
    </>
  );
}

/* ─── STEP 2: Doc Front ───────────────────────────────────────────────────── */
function StepDocFront({
  data,
  onNext,
}: {
  data: { country: CountryConfig; docType: string; sessionId?: string };
  onNext: (d: Record<string, unknown>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [img, setImg] = useState<string | null>(null);
  const [cam, setCam] = useState(false);
  const needsBack = data.docType !== "Passport";

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImg(await fileToDataUrl(f));
  }

  return (
    <div className="fadeUp" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {cam && (
        <CameraOverlay
          mode="doc"
          hint="Align your document inside the frame"
          onCapture={(url) => { setImg(url); setCam(false); }}
          onClose={() => setCam(false)}
        />
      )}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 20px 16px", WebkitOverflowScrolling: "touch" }}>
        <StepHeading
          title="Take a photo"
          subtitle={`Front side of your ${data.docType}`}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <TipChip text="Good lighting" />
          <TipChip text="All corners visible" />
          <TipChip text="No glare" />
        </div>
        <CapturePlaceholder
          img={img}
          mode="doc"
          onTap={() => setCam(true)}
          onDelete={() => setImg(null)}
          aspect="doc"
        />
      </div>
      <BottomBar>
        <CaptureActions
          img={img}
          fileRef={fileRef}
          onCamera={() => setCam(true)}
          onFile={handleFile}
          nextLabel={needsBack ? "Next: Back side" : "Next"}
          onNext={() => onNext({ frontImg: img })}
          nextDisabled={!img}
        />
      </BottomBar>
    </div>
  );
}

/* ─── STEP 3: Doc Back ────────────────────────────────────────────────────── */
function StepDocBack({
  data,
  onNext,
}: {
  data: { docType: string; sessionId?: string };
  onNext: (d: Record<string, unknown>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [img, setImg] = useState<string | null>(null);
  const [cam, setCam] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImg(await fileToDataUrl(f));
  }

  return (
    <div className="fadeUp" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {cam && (
        <CameraOverlay
          mode="doc"
          hint="Align the back of your document"
          onCapture={(url) => { setImg(url); setCam(false); }}
          onClose={() => setCam(false)}
        />
      )}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 20px 16px", WebkitOverflowScrolling: "touch" }}>
        <StepHeading
          title="Back side"
          subtitle={`Back side of your ${data.docType}`}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <TipChip text="Flip your document" />
          <TipChip text="All corners visible" />
          <TipChip text="No glare" />
        </div>
        <CapturePlaceholder
          img={img}
          mode="doc"
          onTap={() => setCam(true)}
          onDelete={() => setImg(null)}
          aspect="doc"
        />
      </div>
      <BottomBar>
        <CaptureActions
          img={img}
          fileRef={fileRef}
          onCamera={() => setCam(true)}
          onFile={handleFile}
          nextLabel="Next"
          onNext={() => onNext({ backImg: img })}
          nextDisabled={!img}
        />
      </BottomBar>
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [cam, setCam] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setSelfie(await fileToDataUrl(f));
  }

  return (
    <div className="fadeUp" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {cam && (
        <CameraOverlay
          mode="selfie"
          hint="Position your face in the oval"
          onCapture={(url) => { setSelfie(url); setCam(false); }}
          onClose={() => setCam(false)}
        />
      )}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 20px 16px", WebkitOverflowScrolling: "touch" }}>
        <StepHeading
          title="Take a selfie"
          subtitle="Make sure your face is clearly visible"
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          <TipChip text="Remove glasses" />
          <TipChip text="Good lighting" />
          <TipChip text="Face the camera" />
        </div>
        <CapturePlaceholder
          img={selfie}
          mode="selfie"
          onTap={() => setCam(true)}
          onDelete={() => setSelfie(null)}
          aspect="selfie"
        />
      </div>
      <BottomBar>
        <CaptureActions
          img={selfie}
          fileRef={fileRef}
          onCamera={() => setCam(true)}
          onFile={handleFile}
          nextLabel="Next"
          onNext={() => onNext({ selfie })}
          nextDisabled={!selfie}
        />
      </BottomBar>
    </div>
  );
}

/* ─── STEP 5: Liveness ───────────────────────────────────────────────────── */
const LIVENESS_CHALLENGES = [
  { id: "left", label: "Look left" },
  { id: "right", label: "Look right" },
  { id: "up", label: "Look up" },
  { id: "down", label: "Look down" },
  { id: "smile", label: "Smile" },
] as const;

const CHALLENGE_DURATION = 2.5;

function StepLiveness({
  data,
  onNext,
}: {
  data: { sessionId?: string };
  onNext: (d: Record<string, unknown>) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [challengeIdx, setChallengeIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [livenessImg, setLivenessImg] = useState<string | null>(null);
  const [camErr, setCamErr] = useState(false);

  const challenge = LIVENESS_CHALLENGES[challengeIdx];

  useEffect(() => {
    if (phase !== "running" || !challenge) return;
    let cancelled = false;
    const start = Date.now();
    const iv = setInterval(() => {
      if (cancelled) return;
      const p = Math.min(1, (Date.now() - start) / 1000 / CHALLENGE_DURATION);
      setProgress(p);
      if (p >= 1) {
        clearInterval(iv);
        if (challengeIdx < LIVENESS_CHALLENGES.length - 1) {
          setChallengeIdx((i) => i + 1);
          setProgress(0);
        } else {
          const v = videoRef.current;
          const c = canvasRef.current;
          if (v && c) {
            c.width = v.videoWidth;
            c.height = v.videoHeight;
            c.getContext("2d")?.drawImage(v, 0, 0);
            setLivenessImg(c.toDataURL("image/jpeg", 0.9));
          }
          setPhase("done");
        }
      }
    }, 50);
    return () => { cancelled = true; clearInterval(iv); };
  }, [phase, challengeIdx]);

  async function startCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
      setChallengeIdx(0);
      setProgress(0);
      setPhase("running");
    } catch {
      setCamErr(true);
    }
  }

  useEffect(() => {
    if (stream && videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  const r = 26;
  const circ = 2 * Math.PI * r;

  return (
    <div className="fadeUp" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 20px 16px", WebkitOverflowScrolling: "touch" }}>
        {phase === "idle" && (
          <>
            <StepHeading
              title="Liveness check"
              subtitle="We'll ask you to move your face in a few directions"
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
              {LIVENESS_CHALLENGES.map((c) => (
                <TipChip key={c.id} text={c.label} />
              ))}
            </div>
            {camErr && (
              <p style={{ color: C.error, fontSize: 13, marginBottom: 16 }}>Camera unavailable. Please allow access.</p>
            )}
          </>
        )}

        {phase === "running" && (
          <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", background: "#000", aspectRatio: "3/4" }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {/* Face oval guide */}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{
                width: "60%",
                height: "70%",
                borderRadius: "50%",
                border: `2.5px solid ${C.brand}`,
                boxShadow: "0 0 0 9999px rgba(0,0,0,.4)",
              }} />
            </div>

            {/* Challenge instruction */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 20px 24px", background: "linear-gradient(transparent,rgba(0,0,0,.75))" }}>
              <p style={{ color: "#fff", fontSize: 18, fontWeight: 700, textAlign: "center", marginBottom: 16 }}>
                {challenge?.label}
              </p>

              {/* 5 dot progress + ring for current */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                {LIVENESS_CHALLENGES.map((ch, i) => {
                  const done = i < challengeIdx;
                  const active = i === challengeIdx;
                  if (active) {
                    return (
                      <svg key={ch.id} width={18 + r * 2} height={18 + r * 2} style={{ transform: "rotate(-90deg)" }}>
                        <circle cx={9 + r} cy={9 + r} r={r} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="4" />
                        <circle
                          cx={9 + r}
                          cy={9 + r}
                          r={r}
                          fill="none"
                          stroke={C.brand}
                          strokeWidth="4"
                          strokeDasharray={circ}
                          strokeDashoffset={circ - progress * circ}
                          strokeLinecap="round"
                          style={{ transition: "stroke-dashoffset 0.05s linear" }}
                        />
                        <circle cx={9 + r} cy={9 + r} r={r - 6} fill={C.brand + "55"} />
                      </svg>
                    );
                  }
                  return (
                    <div
                      key={ch.id}
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: done ? C.success : "rgba(255,255,255,.3)",
                        border: done ? "none" : "2px solid rgba(255,255,255,.5)",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div style={{ textAlign: "center", paddingTop: 24 }}>
            <div className="scaleIn" style={{ marginBottom: 16 }}>
              {Icon.checkCircle(C.success)}
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: C.text }}>Liveness confirmed</h3>
            <p style={{ color: C.textSub, fontSize: 14 }}>All challenges completed successfully</p>
          </div>
        )}
      </div>

      <BottomBar>
        {phase === "idle" && (
          <button onClick={startCamera} style={T.primaryBtn()}>
            Begin liveness check
          </button>
        )}
        {phase === "running" && (
          <button
            onClick={() => { setPhase("idle"); stream?.getTracks().forEach((t) => t.stop()); setStream(null); }}
            style={T.ghostBtn(true)}
          >
            Cancel
          </button>
        )}
        {phase === "done" && livenessImg && (
          <button style={T.primaryBtn()} onClick={() => onNext({ livenessImg })}>
            Next
          </button>
        )}
      </BottomBar>
    </div>
  );
}

/* ─── STEP 6: Submit / Review ─────────────────────────────────────────────── */
function StepSubmit({
  data,
  onNext,
  onCancel,
}: {
  data: {
    frontImg: string;
    backImg?: string;
    selfie: string;
    livenessImg: string;
    sessionId?: string;
    country: CountryConfig;
    docType: string;
  };
  onNext: (d: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setErr(null);
    try {
      const result = await faceApiVerify({
        frontImg: data.frontImg,
        backImg: data.backImg,
        selfie: data.selfie,
        livenessImg: data.livenessImg,
        sessionId: data.sessionId,
      });
      onNext({
        docScore: result.docScore,
        faceScore: result.faceScore,
        livenessScore: result.livenessScore,
        overall: result.overall,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const thumbs = [
    { label: "Document front", img: data.frontImg },
    ...(data.backImg ? [{ label: "Document back", img: data.backImg }] : []),
    { label: "Selfie", img: data.selfie },
  ];

  return (
    <div className="fadeUp" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 20px 16px", WebkitOverflowScrolling: "touch" }}>
        <StepHeading title="Review & submit" subtitle="Check your photos before submitting" />

        {loading && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(255,255,255,.9)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <div className="spin" style={{ width: 44, height: 44, border: `3px solid ${C.border}`, borderTopColor: C.text, borderRadius: "50%" }} />
            <p style={{ color: C.textSub, fontSize: 14, fontWeight: 500 }}>Verifying your identity…</p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {thumbs.map((t) => (
            <div
              key={t.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 16px",
                borderRadius: 14,
                border: `1.5px solid ${C.border}`,
                background: C.bg,
              }}
            >
              <img
                src={t.img}
                alt={t.label}
                style={{ width: 56, height: 44, objectFit: "cover", borderRadius: 8, flexShrink: 0, border: `1px solid ${C.border}` }}
              />
              <span style={{ flex: 1, fontWeight: 500, fontSize: 14, color: C.text }}>{t.label}</span>
              <span style={{ color: C.success }}>{Icon.check}</span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.6 }}>
          Everything looks good? Tap <strong>Submit</strong> to verify your identity.
        </p>

        {err && (
          <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: C.errorBg, border: `1px solid ${C.error}30`, color: C.error, fontSize: 13 }}>
            {err}
          </div>
        )}
      </div>

      <BottomBar>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={submit} style={T.primaryBtn(loading)} disabled={loading}>
            Submit
          </button>
          <button onClick={onCancel} style={T.ghostBtn()}>
            Go back
          </button>
        </div>
      </BottomBar>
    </div>
  );
}

/* ─── STEP 7: Result ─────────────────────────────────────────────────────── */
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
    { label: "Face match", score: data.faceScore },
    { label: "Liveness", score: data.livenessScore },
    { label: "Document quality", score: data.docScore },
  ];

  const statusIcon =
    overall >= 85
      ? Icon.checkCircle(C.success)
      : overall >= 65
      ? Icon.reviewCircle(C.warn)
      : Icon.xCircle(C.error);

  return (
    <div className="fadeUp" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 20px 16px", WebkitOverflowScrolling: "touch" }}>

        {/* Status hero */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div className="scaleIn" style={{ marginBottom: 16 }}>{statusIcon}</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: "-.03em", marginBottom: 6 }}>
            {v.label}
          </h2>
          <span
            style={{
              display: "inline-block",
              padding: "4px 14px",
              borderRadius: 20,
              background: v.bg,
              color: v.color,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Score: {overall}/100
          </span>
          <p style={{ color: C.textMuted, fontSize: 11, marginTop: 8, letterSpacing: ".02em" }}>{id}</p>
        </div>

        {/* Metadata */}
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: "12px 16px",
            borderRadius: 12,
            background: C.surface,
            border: `1px solid ${C.border}`,
            marginBottom: 20,
          }}
        >
          <span style={{ fontSize: 20 }}>{data.country.flag}</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{data.country.name}</p>
            <p style={{ fontSize: 12, color: C.textSub }}>{data.docType}</p>
          </div>
        </div>

        {/* Score rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
          {rows.map((r) => {
            const color = r.score >= 75 ? C.success : r.score >= 50 ? C.warn : C.error;
            return (
              <div key={r.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: C.textSub, fontWeight: 500 }}>{r.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color }}>{r.score}/100</span>
                </div>
                <div style={{ height: 6, borderRadius: 4, background: C.border }}>
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 4,
                      width: `${r.score}%`,
                      background: color,
                      transition: "width 1s ease",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Verdict message */}
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            background: v.bg,
            border: `1px solid ${v.color}30`,
            color: v.color,
            fontSize: 13,
            lineHeight: 1.6,
            fontWeight: 500,
          }}
        >
          {overall >= 85 && "Your identity has been successfully verified."}
          {overall >= 65 && overall < 85 && "Your submission is under review. We'll notify you within 24 hours."}
          {overall < 65 && "Verification failed. Please retry with better lighting and a clearer document."}
        </div>
      </div>

      <BottomBar>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            style={T.primaryBtn()}
            onClick={() => {
              const report = {
                verificationId: id,
                overall,
                verdict: v.label,
                country: data.country.name,
                docType: data.docType,
                faceScore: data.faceScore,
                livenessScore: data.livenessScore,
                docScore: data.docScore,
                timestamp: new Date().toISOString(),
              };
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
              a.download = `${id}.json`;
              a.click();
            }}
          >
            Download Report
          </button>
          <button style={T.ghostBtn()} onClick={() => window.location.reload()}>
            Start over
          </button>
        </div>
      </BottomBar>
    </div>
  );
}

/* ─── MAIN ────────────────────────────────────────────────────────────────── */
const STEP_LABELS_WITH_BACK = ["Select", "Front", "Back", "Selfie", "Liveness", "Submit", "Result"];
const STEP_LABELS_NO_BACK = ["Select", "Front", "Selfie", "Liveness", "Submit", "Result"];

export default function App() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [countries, setCountries] = useState<CountryConfig[]>(FALLBACK_COUNTRIES);
  const [init, setInit] = useState(false);

  useEffect(() => { loadFaceApiModels(); }, []);

  useEffect(() => {
    fetchConfig()
      .then((c) => { setCountries(c.countries); setInit(true); })
      .catch(() => setInit(true));
  }, []);

  const needsBack = Boolean(data.docType && data.docType !== "Passport");
  const TOTAL = needsBack ? 7 : 6;

  function advance(extra: Record<string, unknown> = {}) {
    setData((p) => ({ ...p, ...extra }));
    setStep((p) => p + 1);
  }
  function back() {
    setStep((p) => Math.max(1, p - 1));
  }

  const isResult = step === (needsBack ? 7 : 6);
  const showBack = step > 1 && !isResult;
  const labels = needsBack ? STEP_LABELS_WITH_BACK : STEP_LABELS_NO_BACK;

  const countryDisplay =
    data.country && typeof data.country === "object" && "flag" in data.country && "code" in data.country
      ? `${(data.country as CountryConfig).flag} ${(data.country as CountryConfig).code}`
      : undefined;

  if (!init) {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
        <div className="spin" style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.text, borderRadius: "50%" }} />
      </div>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: C.bg, maxWidth: 480, margin: "0 auto" }}>
        <Header step={step} total={TOTAL} onBack={showBack ? back : null} country={countryDisplay} />

        {/* Step label */}
        <div style={{ padding: "10px 20px 0", flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: ".06em", textTransform: "uppercase" }}>
            {labels[step - 1]}
          </span>
        </div>

        {/* Step content */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {step === 1 && <StepCountryDoc countries={countries} onNext={(d) => advance(d)} />}
          {step === 2 && (
            <StepDocFront
              data={data as { country: CountryConfig; docType: string; sessionId?: string }}
              onNext={(d) => advance(d)}
            />
          )}
          {step === 3 && needsBack && (
            <StepDocBack
              data={data as { docType: string; sessionId?: string }}
              onNext={(d) => advance(d)}
            />
          )}
          {step === (needsBack ? 4 : 3) && (
            <StepSelfie
              data={data as { docType: string; frontImg?: string; sessionId?: string }}
              onNext={(d) => advance(d)}
            />
          )}
          {step === (needsBack ? 5 : 4) && (
            <StepLiveness data={data as { sessionId?: string }} onNext={(d) => advance(d)} />
          )}
          {step === (needsBack ? 6 : 5) && (
            <StepSubmit
              data={data as {
                frontImg: string;
                backImg?: string;
                selfie: string;
                livenessImg: string;
                sessionId?: string;
                country: CountryConfig;
                docType: string;
              }}
              onNext={(d) => advance(d)}
              onCancel={back}
            />
          )}
          {step === (needsBack ? 7 : 6) && (
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
