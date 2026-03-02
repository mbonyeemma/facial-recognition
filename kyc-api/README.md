# KYC API

Node.js backend for face analysis (document quality, face matching, liveness) using **AWS Rekognition**.

## Prerequisites

- AWS account with Rekognition access
- IAM user/role with `rekognition:DetectFaces` and `rekognition:CompareFaces` permissions

## Setup

```bash
npm install
```

Configure AWS credentials:

```bash
# Option 1: Environment variables
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_REGION=us-east-1

# Option 2: AWS CLI profile (~/.aws/credentials)
export AWS_PROFILE=your_profile
```

## Run

```bash
npm run dev    # Development (port 3001)
npm run build && npm start   # Production
```

## Endpoints

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/health` | - | `{ ok: true }` |
| GET | `/ready` | - | `{ ok: true }` |
| POST | `/analyze-doc` | `{ image: "data:image/jpeg;base64,..." }` | `{ score: 0-100 }` |
| POST | `/compare-faces` | `{ document: "...", selfie: "..." }` | `{ score: 0-100 }` |
| POST | `/analyze-liveness` | `{ image: "data:image/jpeg;base64,..." }` | `{ score: 0-100 }` |

## Environment

- `AWS_ACCESS_KEY_ID` – AWS access key
- `AWS_SECRET_ACCESS_KEY` – AWS secret key
- `AWS_REGION` – AWS region (default: us-east-1)
- `PORT` – Server port (default: 3001)
