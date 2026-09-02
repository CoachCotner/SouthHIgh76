import { randomUUID, createHash } from "node:crypto";
import { photoStore, PHOTO_PREFIX, detectFormat, json } from "./_lib.mjs";

const MAX_FILES = 20;
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_NAME = 80;
const MAX_CAPTION = 300;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let form;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "We couldn't read that upload. Try again?" }, 400);
  }

  // Honeypot: real people never see this field, bots fill it in. Answer with a
  // plausible success so the bot doesn't start probing for what gave it away.
  if (String(form.get("website") || "").trim()) {
    return json({ ok: true, saved: 0 });
  }

  const name = String(form.get("name") || "").trim().slice(0, MAX_NAME);
  const caption = String(form.get("caption") || "").trim().slice(0, MAX_CAPTION);
  if (!name) return json({ error: "Please add your name." }, 400);
  if (!caption) return json({ error: "Please add a caption." }, 400);

  const files = form
    .getAll("photos")
    .filter((f) => typeof f === "object" && f !== null && typeof f.arrayBuffer === "function" && f.size > 0);

  if (files.length === 0) return json({ error: "Please choose at least one photo." }, 400);
  if (files.length > MAX_FILES) {
    return json({ error: `That's more than ${MAX_FILES} photos at once — send them in a couple of batches.` }, 400);
  }

  const store = photoStore();
  const uploadedAt = new Date().toISOString();
  const saved = [];
  const rejected = [];

  for (const file of files) {
    const label = file.name || "photo";

    if (file.size > MAX_BYTES) {
      rejected.push({ name: label, reason: "larger than 12MB" });
      continue;
    }

    // Identify by content, not by the type the phone claimed — see _lib.mjs.
    const buffer = await file.arrayBuffer();
    const format = detectFormat(buffer);
    if (!format) {
      rejected.push({ name: label, reason: "not an image file" });
      continue;
    }

    const key = `${PHOTO_PREFIX}${Date.now()}-${randomUUID()}.${format.ext}`;

    // A per-photo secret, returned to whoever uploaded it and stored only as a
    // hash. It lets them pull their own photo back off the wall without giving
    // everyone browsing the gallery the same power — the ids are public, the
    // tokens are not.
    const token = randomUUID();
    const tokenHash = createHash("sha256").update(token).digest("hex");

    await store.set(key, buffer, {
      metadata: {
        name,
        caption,
        uploadedAt,
        contentType: format.mime,
        displayable: format.displayable,
        tokenHash,
      },
    });
    saved.push({ id: key.slice(PHOTO_PREFIX.length), token });
  }

  if (saved.length === 0) {
    return json({ error: "None of those files were photos we could accept.", rejected }, 400);
  }
  return json({ ok: true, saved: saved.length, photos: saved, rejected });
};

export const config = { path: "/api/upload" };
