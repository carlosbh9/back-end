const crypto = require('crypto');
const path = require('path');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const PRESIGN_EXPIRES = Number(process.env.S3_PRESIGN_EXPIRES_SECONDS || 600);

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED'
});

const SERVICE_ORDER_BUCKET = process.env.S3_SERVICE_ORDER_BUCKET || process.env.S3_PASSPORT_BUCKET;
const SERVICE_ORDER_REGION = process.env.AWS_REGION || 'us-east-1';

function ensureValidUpload(fileName, contentType) {
  const ext = path.extname(fileName || '').toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    const error = new Error(`Invalid file extension: ${ext}`);
    error.status = 400;
    throw error;
  }
  if (!ALLOWED_MIME.has(contentType)) {
    const error = new Error(`Invalid contentType: ${contentType}`);
    error.status = 400;
    throw error;
  }
}

function buildServiceOrderAttachmentKey({ orderId, attachmentType, originalName }) {
  const ext = path.extname(originalName || '').toLowerCase();
  const uuid = crypto.randomUUID();
  const safeType = String(attachmentType || 'OTHER').toLowerCase();
  return `service-orders/${orderId}/${safeType}/${uuid}${ext}`;
}

function buildFileUrl(key) {
  return `https://${SERVICE_ORDER_BUCKET}.s3.${SERVICE_ORDER_REGION}.amazonaws.com/${key}`;
}

async function createServiceOrderAttachmentPresign({ orderId, fileName, contentType, attachmentType }) {
  if (!SERVICE_ORDER_BUCKET) {
    const error = new Error('S3_SERVICE_ORDER_BUCKET is not configured');
    error.status = 500;
    throw error;
  }

  ensureValidUpload(fileName, contentType);

  const key = buildServiceOrderAttachmentKey({
    orderId,
    attachmentType,
    originalName: fileName
  });

  const cmd = new PutObjectCommand({
    Bucket: SERVICE_ORDER_BUCKET,
    Key: key,
    ContentType: contentType
  });

  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: PRESIGN_EXPIRES });
  return {
    key,
    fileUrl: buildFileUrl(key),
    uploadUrl,
    expiresIn: PRESIGN_EXPIRES,
    bucket: SERVICE_ORDER_BUCKET
  };
}

async function createServiceOrderAttachmentReadPresign({ key, fileName = '' }) {
  if (!SERVICE_ORDER_BUCKET) {
    const error = new Error('S3_SERVICE_ORDER_BUCKET is not configured');
    error.status = 500;
    throw error;
  }
  if (!key) {
    const error = new Error('storage key is required');
    error.status = 400;
    throw error;
  }

  const cmd = new GetObjectCommand({
    Bucket: SERVICE_ORDER_BUCKET,
    Key: key,
    ResponseContentDisposition: fileName
      ? `inline; filename="${String(fileName).replace(/"/g, '')}"`
      : undefined
  });

  const url = await getSignedUrl(s3, cmd, { expiresIn: PRESIGN_EXPIRES });
  return {
    url,
    expiresIn: PRESIGN_EXPIRES
  };
}

module.exports = {
  createServiceOrderAttachmentPresign,
  createServiceOrderAttachmentReadPresign,
  SERVICE_ORDER_BUCKET
};
