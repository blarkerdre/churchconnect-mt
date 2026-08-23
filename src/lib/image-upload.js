import { supabase } from "@/integrations/supabase/client";
import { assertStorageAvailable } from "@/lib/storageQuota";

export const ACCEPTED_PHOTO_TYPES =
  "image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif";

const ALLOWED_MIME = /^image\/(jpeg|jpg|png|webp|heic|heif)$/i;
const MAX_INPUT_BYTES = 5 * 1024 * 1024; // 5MB before processing
const MAX_EDGE = 1024; // longest side after downscale
const JPEG_QUALITY = 0.85;

class FriendlyError extends Error {
  constructor(message) {
    super(message);
    this.friendly = true;
  }
}

/**
 * Validates, downscales and re-encodes a user-selected image to JPEG so it is
 * always renderable in the browser (converts HEIC where the device can decode
 * it) and small enough to upload on a mobile connection.
 *
 * @param {File} file
 * @returns {Promise<Blob>} JPEG blob
 */
export async function processImageForUpload(file) {
  if (!file) throw new FriendlyError("No image selected.");
  if (file.type && !ALLOWED_MIME.test(file.type)) {
    throw new FriendlyError(
      "That file type isn't supported. Please choose a JPG, PNG or WEBP image."
    );
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new FriendlyError(
      "That photo is larger than 5MB. Please choose a smaller photo."
    );
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new FriendlyError(
      "This photo format isn't supported on this device — please choose a JPG or PNG."
    );
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) {
    throw new FriendlyError(
      "We couldn't process that photo. Please try a different image."
    );
  }
  return blob;
}

/**
 * Turns any upload error into a plain-English message.
 */
export function friendlyUploadError(err) {
  if (!err) return "Something went wrong. Please try again.";
  if (err.friendly) return err.message;
  if (err.code === "STORAGE_LIMIT_REACHED") return err.message;
  const msg = String(err.message || "");
  if (!navigator.onLine || /failed to fetch|network/i.test(msg)) {
    return "You appear to be offline. Please check your connection and try again.";
  }
  if (/payload too large|entity too large|413/i.test(msg)) {
    return "That photo is too large to upload. Please choose a smaller photo.";
  }
  if (/row-level security|not authorized|403/i.test(msg)) {
    return "You don't have permission to change this photo.";
  }
  return msg || "Upload failed. Please try again.";
}

/**
 * Processes and uploads a profile photo into the private `profile-photos`
 * bucket, then removes the previously stored photo.
 *
 * @param {Object} args
 * @param {File} args.file          selected file
 * @param {string} args.folder      storage folder (`<user id>` or `member-<member id>`)
 * @param {string|null} args.previousPath  existing members.photo_url value
 * @param {string|null} args.tenantId      for the storage-quota check
 * @returns {Promise<string>} the new storage path
 */
export async function uploadProfilePhoto({ file, folder, previousPath, tenantId }) {
  const blob = await processImageForUpload(file);
  await assertStorageAvailable(tenantId, blob.size);

  const path = `${folder}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from("profile-photos")
    .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
  if (error) throw error;
  return path;
}

/**
 * Best-effort cleanup of a replaced photo. Ignores legacy full URLs and errors.
 */
export async function removeOldProfilePhoto(previousPath, newPath) {
  if (!previousPath || previousPath === newPath) return;
  if (/^https?:\/\//i.test(previousPath)) return;
  try {
    await supabase.storage.from("profile-photos").remove([previousPath]);
  } catch (err) {
    console.warn("Could not remove old profile photo:", err);
  }
}
