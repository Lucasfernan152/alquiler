import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { get, put } from "@vercel/blob";
import multer from "multer";
import { env, MAX_UPLOAD_BYTES } from "../lib/env.js";

function safeName(original: string) {
  return original.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Multer en memoria: el destino final lo decide `persistUpload`. */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

export type StoredFile = {
  /** URL de Blob (privada) o nombre de archivo local. */
  filePath: string;
  fileName: string;
};

/**
 * Guarda el archivo subido.
 * - Con `BLOB_READ_WRITE_TOKEN`: Vercel Blob privado (prod / serverless).
 * - Sin token: disco local `UPLOAD_DIR` (dev).
 */
export async function persistUpload(
  file: Express.Multer.File,
): Promise<StoredFile> {
  const fileName = file.originalname;
  const key = `uploads/${Date.now()}-${safeName(fileName)}`;

  if (env.blobToken) {
    const blob = await put(key, file.buffer, {
      access: "private",
      token: env.blobToken,
      contentType: file.mimetype || undefined,
      addRandomSuffix: true,
    });
    return { filePath: blob.url, fileName };
  }

  fs.mkdirSync(env.uploadDir, { recursive: true });
  const localName = path.basename(key);
  fs.writeFileSync(path.join(env.uploadDir, localName), file.buffer);
  return { filePath: localName, fileName };
}

export function isRemoteFilePath(filePath: string) {
  return /^https?:\/\//i.test(filePath);
}

export function publicUploadPath(filename: string): string {
  return path.join(env.uploadDir, path.basename(filename));
}

/**
 * Lee un blob privado y lo pipea a la response de Express.
 * El store es private: la URL sola no alcanza, hace falta el token.
 */
export async function streamRemoteFile(
  fileUrl: string,
  res: import("express").Response,
): Promise<boolean> {
  const result = await get(fileUrl, {
    access: "private",
    token: env.blobToken,
  });

  if (!result || result.statusCode !== 200 || !result.stream) {
    return false;
  }

  if (result.blob.contentType) {
    res.setHeader("Content-Type", result.blob.contentType);
  }
  res.setHeader("Cache-Control", "private, max-age=3600");

  Readable.fromWeb(result.stream as NodeWebReadableStream).pipe(res);
  return true;
}
