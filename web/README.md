# Bava KYC

KYC verification flow with face detection, document quality, and liveness checks.

## Structure

- **Frontend** – React + Vite app (this directory)
- **kyc-api** – Node.js backend (AWS Rekognition)

## Quick Start

Run both frontend and API:

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001 (proxied via `/kyc-api` in dev)

Or run separately:

```bash
# Terminal 1 – API
cd kyc-api && npm run dev

# Terminal 2 – Frontend
npm run dev:web
```

Set `VITE_KYC_API_URL` if the API is on a different URL (e.g. production).
