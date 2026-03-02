/**
 * S3 upload service for KYC images
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const bucket = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_REGION || "us-east-1";

const client = bucket
  ? new S3Client({ region })
  : null;

export function getS3Url(key: string): string {
  if (!bucket) return "";
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export async function uploadToS3(
  sessionId: string,
  type: string,
  imageBase64: string
): Promise<string | null> {
  if (!client || !bucket) return null;

  const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  const ext = imageBase64.includes("png") ? "png" : "jpg";
  const key = `kyc/${sessionId}/${type}.${ext}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: `image/${ext}`,
    })
  );

  return getS3Url(key);
}
