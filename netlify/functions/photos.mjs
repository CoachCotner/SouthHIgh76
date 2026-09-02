import { photoStore, PHOTO_PREFIX, photoId, json } from "./_lib.mjs";

const PAGE_SIZE = 60;

export default async (req) => {
  const url = new URL(req.url);
  const before = url.searchParams.get("before"); // key cursor for paging

  const store = photoStore();
  const { blobs } = await store.list({ prefix: PHOTO_PREFIX });

  // Keys sort chronologically (see _lib.mjs), so newest-first is a reverse sort
  // and paging is a slice — no metadata reads needed to order the wall.
  const keys = blobs
    .map((b) => b.key)
    .sort()
    .reverse();

  // Resume at the first key older than the cursor rather than looking the
  // cursor up by index. If the photo someone was scrolled past gets deleted
  // out from under them, an index lookup would miss and silently restart the
  // wall from the top — this picks up in the right place instead.
  let start = 0;
  if (before) {
    const cursorKey = `${PHOTO_PREFIX}${before}`;
    const i = keys.findIndex((key) => key < cursorKey);
    start = i === -1 ? keys.length : i;
  }
  const page = keys.slice(start, start + PAGE_SIZE);

  // Only the page being shown pays for a metadata read.
  const photos = await Promise.all(
    page.map(async (key) => {
      const meta = await store.getMetadata(key);
      const id = photoId(key);
      return {
        id,
        url: `/api/photo/${id}`,
        name: meta?.metadata?.name || "",
        caption: meta?.metadata?.caption || "",
        uploadedAt: meta?.metadata?.uploadedAt || null,
      };
    })
  );

  return json(
    {
      photos,
      total: keys.length,
      nextCursor: page.length > 0 && start + PAGE_SIZE < keys.length ? photoId(page[page.length - 1]) : null,
    },
    200,
    // Brief cache so a room full of people polling the wall doesn't hammer the
    // function, while new photos still surface within a few seconds.
    { "cache-control": "public, max-age=5, stale-while-revalidate=30" }
  );
};

export const config = { path: "/api/photos" };
