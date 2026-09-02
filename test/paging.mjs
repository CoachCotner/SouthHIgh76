const F = "../netlify/functions/";
const upload   = (await import(F + "upload.mjs")).default;
const photosFn = (await import(F + "photos.mjs")).default;

let fail = 0, n = 0;
const ok = (c,m) => { n++; if(!c){ console.log("  FAIL:", m); fail++; } else console.log("  pass:", m); };
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082","hex");

// 145 photos = 3 pages at PAGE_SIZE 60. Upload in batches of 20 (the cap).
let uploaded = 0;
for (let b = 0; b < 8; b++){
  const count = b === 7 ? 5 : 20;
  const fd = new FormData();
  fd.append("name", `Person ${b}`);
  fd.append("caption", `Batch ${b}`);
  for (let i = 0; i < count; i++) fd.append("photos", new File([PNG], `p${b}_${i}.png`, { type:"image/png" }));
  const r = await upload(new Request("https://x/api/upload", { method:"POST", body: fd }));
  uploaded += (await r.json()).saved;
  await new Promise(r => setTimeout(r, 2)); // let the clock tick between batches
}
ok(uploaded === 145, `uploaded 145 (got ${uploaded})`);

// Walk every page the way the browser does.
const seen = [];
let cursor = null, pages = 0;
do {
  const url = "https://x/api/photos" + (cursor ? "?before=" + encodeURIComponent(cursor) : "");
  const data = await (await photosFn(new Request(url))).json();
  pages++;
  seen.push(...data.photos.map(p => p.id));
  cursor = data.nextCursor;
  if (pages > 10) break; // guard against a cursor that never terminates
} while (cursor);

ok(pages === 3, `3 pages for 145 photos (got ${pages})`);
ok(seen.length === 145, `saw all 145 across pages (got ${seen.length})`);
ok(new Set(seen).size === 145, "no photo appears on two pages");
const ts = seen.map(id => id.split("-")[0]);
ok(JSON.stringify(ts) === JSON.stringify([...ts].sort().reverse()), "newest-first order holds across page boundaries");

// The real stale-cursor case: someone loads page 1, an admin deletes the photo
// their cursor points at, then they hit "Load more". Page 2 must still start
// where it should — not replay page 1 and duplicate the whole wall.
const page1 = await (await photosFn(new Request("https://x/api/photos"))).json();
const staleCursor = page1.nextCursor;
const { getStore } = await import("./fake-blobs.mjs");
await getStore("reunion-photos").delete("photos/" + staleCursor);

const after = await (await photosFn(new Request("https://x/api/photos?before=" + encodeURIComponent(staleCursor)))).json();
ok(after.photos.length > 0, "still returns a page after the cursor photo was deleted");
ok(!after.photos.some(p => page1.photos.some(q => q.id === p.id)), "no overlap with page 1 — the wall does not duplicate");
ok(after.photos[0].id === seen[60], `resumes at the right photo (${after.photos[0].id === seen[60] ? "ok" : after.photos[0].id})`);

console.log(`\n${n-fail}/${n} passed` + (fail ? " — FAILURES" : ""));
process.exit(fail ? 1 : 0);
