/**
 * @file apps/backend/src/services/upload.service.ts
 * @description Service for handling file uploads.
 * Accepts multipart form data containing purchase books and GSTR files,
 * stores them (locally or to S3 in Phase 3), and persists metadata to MongoDB.
 *
 * Phase 1: Scaffold with placeholder implementation.
 * Phase 3: Implement actual file storage (local → S3).
 * Phase 4: Trigger parsing pipeline after upload.
 */

import type { UploadResponse, UploadedFileInfo } from '@gst/shared';

/**
 * Processes uploaded files from a multipart form submission.
 * Stores files and returns metadata for each uploaded document.
 *
 * @param userId - The ID of the user uploading the files
 * @param files - Array of uploaded File objects
 * @returns Upload response with metadata for each processed file
 *
 * TODO (Phase 3): Implement S3 upload using AWS SDK
 * TODO (Phase 3): Store file metadata in UserModel.purchaseData / gstrData
 * TODO (Phase 4): Trigger the parsing/standardization pipeline
 */
export async function processUploadedFiles(
  userId: string,
  files: File[],
): Promise<UploadResponse> {
  // TODO (Phase 3): Replace placeholder with actual implementation

  const uploadedFiles: UploadedFileInfo[] = files.map((file) => ({
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    docId: `placeholder-doc-id-${Date.now()}`,
  }));

  return {
    userId,
    uploadedFiles,
    totalFiles: files.length,
  };
}
