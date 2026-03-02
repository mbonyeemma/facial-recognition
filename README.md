# Bava KYC

KYC verification flow with face detection, document quality checks, and liveness verification. Uses **AWS Rekognition** for face analysis.

## Structure

```
bava-kyc/
├── web/          # React + Vite frontend
├── kyc-api/      # Node.js backend (AWS Rekognition)
└── README.md
```

## Prerequisites

- Node.js 18+
- AWS account with Rekognition access
- IAM permissions: `rekognition:DetectFaces`, `rekognition:CompareFaces`

## Quick Start

### 1. Install dependencies

```bash
cd web && npm install
cd ../kyc-api && npm install
```

### 2. Configure AWS credentials

```bash
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_REGION=us-east-1
```

Or use `~/.aws/credentials` with `AWS_PROFILE`.

### 3. Run

**Option A – Run both together (from `web/`):**

```bash
cd web
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001 (proxied via `/kyc-api` in dev)

**Option B – Run separately:**

```bash
# Terminal 1 – API
cd kyc-api && npm run dev

# Terminal 2 – Frontend
cd web && npm run dev:web
```

## Environment

| Variable | Description |
|----------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_REGION` | AWS region (default: us-east-1) |
| `VITE_KYC_API_URL` | API URL for production (default: `/kyc-api`) |
| `PORT` | API port (default: 3001) |

## API Endpoints

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/analyze-doc` | `{ image: "data:image/jpeg;base64,..." }` | `{ score: 0-100 }` |
| POST | `/compare-faces` | `{ document: "...", selfie: "..." }` | `{ score: 0-100 }` |
| POST | `/analyze-liveness` | `{ image: "data:image/jpeg;base64,..." }` | `{ score: 0-100 }` |

## Build

```bash
cd web && npm run build
cd ../kyc-api && npm run build
```

## License

Private
