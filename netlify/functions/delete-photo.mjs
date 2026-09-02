import { createHash, timingSafeEqual } from "node:crypto";
import { photoStore, PHOTO_PREFIX, isValidPhotoId, json } from "./_lib.mjs";

function sameSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  const { id, token, password } = body || {};
  if (!isValidPhotoId(id || "")) return json({ error: "Unknown photo." }, 400);

  const store = photoStore();
  const key = `${PHOTO_PREFIX}${id}`;
  const meta = await store.getMetadata(key);
  if (!meta) return json({ error: "That photo is already gone." }, 404);

  const adminPassword = process.env.REUNION_ADMIN_PASSWORD;
  const isAdmin = Boolean(adminPassword) && sameSecret(password || "", adminPassword);

  const tokenHash = meta.metadata?.tokenHash;
  const isOwner =
    Boolean(tokenHash) &&
    Boolean(token) &&
    sameSecret(createHash("sha256").update(String(token)).digest("hex"), tokenHash);

  if (!isAdmin && !isOwner) return json({ error: "Not allowed." }, 403);

  await store.delete(key);
  return json({ ok: true });
};

export const config = { path: "/api/delete-photo" };
