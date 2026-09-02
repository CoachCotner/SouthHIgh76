import { photoStore, PHOTO_PREFIX, TYPE_BY_EXT, isValidPhotoId } from "./_lib.mjs";

export default async (req, context) => {
  const id = context.params.id;
  if (!isValidPhotoId(id)) return new Response("Not found", { status: 404 });

  const store = photoStore();
  const blob = await store.getWithMetadata(`${PHOTO_PREFIX}${id}`, { type: "arrayBuffer" });
  if (!blob?.data) return new Response("Not found", { status: 404 });

  const ext = id.split(".").pop();
  const type = blob.metadata?.contentType || TYPE_BY_EXT[ext] || "application/octet-stream";

  return new Response(blob.data, {
    headers: {
      "content-type": type,
      // Ids are unique and content never changes, so this is safe to pin at
      // the edge — the function only runs on the first request for a photo.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
};

export const config = { path: "/api/photo/:id" };
