const F = "../netlify/functions/";
const upload      = (await import(F + "upload.mjs")).default;
const photosFn    = (await import(F + "photos.mjs")).default;
const photoFn     = (await import(F + "photo.mjs")).default;
const deleteFn    = (await import(F + "delete-photo.mjs")).default;
const adminCheck  = (await import(F + "admin-check.mjs")).default;

let fail = 0, n = 0;
const ok = (c, m) => { n++; if(!c){ console.log("  FAIL:", m); fail++; } else console.log("  pass:", m); };

// A real 1x1 PNG so content-type sniffing has something honest to chew on.
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082","hex");
const jpegBytes = (kb) => Buffer.concat([Buffer.from("ffd8ffe0","hex"), Buffer.alloc(kb*1024, 7)]);

function post(fields, files){
  const fd = new FormData();
  for (const [k,v] of Object.entries(fields)) fd.append(k, v);
  // Matched pairs, exactly as the page sends them.
  for (const f of files) {
    fd.append("photos", new File([f.bytes], f.name, { type: f.type }));
    fd.append("captions", f.caption ?? "");
  }
  return new Request("https://southhigh76.com/api/upload", { method: "POST", body: fd });
}

console.log("\n1. Upload happy path");
let res = await upload(post({ name:"Lauren Cotner", caption:"Dance floor, 9pm" },
  [{bytes:PNG,name:"a.png",type:"image/png"},{bytes:jpegBytes(40),name:"b.jpg",type:"image/jpeg"}]));
let body = await res.json();
ok(res.status === 200 && body.ok, "200 + ok");
ok(body.saved === 2, "saved 2 photos");
ok(body.photos.length === 2 && body.photos.every(p => p.id && p.token), "each photo returned an id and a token");
ok(body.photos[0].token !== body.photos[1].token, "tokens are per-photo, not per-batch");
const [p1, p2] = body.photos;

console.log("\n2. Validation");
ok((await upload(post({name:"", caption:"x"}, [{bytes:PNG,name:"a.png",type:"image/png"}]))).status === 400, "name required");
ok((await upload(post({name:"X", caption:""}, [{bytes:PNG,name:"a.png",type:"image/png"}]))).status === 400, "caption required");
ok((await upload(post({name:"X", caption:"y"}, []))).status === 400, "at least one photo required");
res = await upload(post({name:"X",caption:"y"}, [{bytes:Buffer.from("MZ..."),name:"virus.exe",type:"application/x-msdownload"}]));
ok(res.status === 400, "non-image rejected");
res = await upload(post({name:"X",caption:"y"}, Array.from({length:21}, (_,i) => ({bytes:PNG,name:`p${i}.png`,type:"image/png"}))));
ok(res.status === 400 && (await res.json()).error.includes("20"), "more than 20 files rejected");
res = await upload(post({name:"X",caption:"y"}, [{bytes:jpegBytes(13*1024),name:"huge.jpg",type:"image/jpeg"}]));
ok(res.status === 400, "over-12MB file rejected");
ok((await upload(new Request("https://x/api/upload",{method:"GET"}))).status === 405, "GET rejected");

console.log("\n3. Honeypot");
res = await upload(post({name:"Bot", caption:"spam", website:"http://spam.ru"}, [{bytes:PNG,name:"s.png",type:"image/png"}]));
body = await res.json();
ok(res.status === 200 && body.saved === 0, "bot gets a plausible 200 but nothing is stored");

console.log("\n4. Mixed batch keeps the good ones");
res = await upload(post({name:"Mix",caption:"some good some bad"},
  [{bytes:PNG,name:"good.png",type:"image/png"},{bytes:Buffer.from("x"),name:"bad.txt",type:"text/plain"}]));
body = await res.json();
ok(res.status === 200 && body.saved === 1 && body.rejected.length === 1, "1 saved, 1 reported rejected");

console.log("\n5. Listing");
res = await photosFn(new Request("https://southhigh76.com/api/photos"));
body = await res.json();
ok(res.status === 200, "200");
ok(body.total === 3, `3 photos on the wall — 2 from the happy path + 1 from the mixed batch (got ${body.total})`);
ok(body.photos[0].name && body.photos[0].caption, "name + caption come back");
ok(!("tokenHash" in body.photos[0]), "tokenHash is NOT leaked to the public listing");
ok(!("token" in body.photos[0]), "token is NOT leaked to the public listing");
const times = body.photos.map(p => p.id.split("-")[0]);
ok(JSON.stringify(times) === JSON.stringify([...times].sort().reverse()), "newest first");
ok(res.headers.get("cache-control").includes("max-age=5"), "short CDN cache set");

console.log("\n6. Serving an image");
res = await photoFn(new Request("https://x/api/photo/"+p1.id), { params:{ id:p1.id } });
ok(res.status === 200, "200");
ok(res.headers.get("content-type") === "image/png", "correct content-type from metadata");
ok(res.headers.get("cache-control").includes("immutable"), "immutable cache header");
ok(Buffer.from(await res.arrayBuffer()).equals(PNG), "bytes round-trip unchanged");
ok((await photoFn(new Request("https://x"), { params:{ id:"../../netlify.toml" } })).status === 404, "path traversal blocked");
ok((await photoFn(new Request("https://x"), { params:{ id:"1788000000000-"+"0".repeat(36)+".jpg" } })).status === 404, "unknown id 404s");

console.log("\n7. Delete permissions");
const del = (b) => deleteFn(new Request("https://x/api/delete-photo",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)}));
ok((await del({ id:p1.id })).status === 403, "no token, no password -> 403");
ok((await del({ id:p1.id, token:"wrong-token" })).status === 403, "wrong token -> 403");
ok((await del({ id:p1.id, token:p2.token })).status === 403, "another photo's token -> 403");
ok((await del({ id:p1.id, password:"hunter2" })).status === 403, "wrong password -> 403");
ok((await del({ id:p1.id, token:p1.token })).status === 200, "correct owner token -> deleted");
ok((await del({ id:p1.id, token:p1.token })).status === 404, "already deleted -> 404");
process.env.REUNION_ADMIN_PASSWORD = "testpass123";
ok((await del({ id:p2.id, password:"testpass123" })).status === 200, "admin password -> deleted");
res = await photosFn(new Request("https://x/api/photos"));
ok((await res.json()).total === 1, "wall is down to 1 after both deletions");

console.log("\n8. Admin gate");
const chk = (pw) => adminCheck(new Request("https://x/api/admin-check",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({password:pw})}));
ok((await chk("testpass123")).status === 200, "right password unlocks");
ok((await chk("nope")).status === 403, "wrong password rejected");
ok((await chk("testpass1234")).status === 403, "longer near-miss rejected (no timingSafeEqual crash)");
ok((await chk("")).status === 403, "empty password rejected");
delete process.env.REUNION_ADMIN_PASSWORD;
ok((await chk("anything")).status === 503, "no password configured -> 503, never an accidental unlock");
ok((await del({ id:"x" })).status === 400, "malformed id -> 400");

console.log("\n9. Per-photo captions");
{
  const { getStore } = await import("./fake-blobs.mjs");
  const store = getStore("reunion-photos");
  const capOf = async (id) => (await store.getMetadata("photos/" + id))?.metadata;

  // Three photos: two captioned individually, one left blank.
  let r = await upload(post({ name:"Janet W.", caption:"Table 4 all night" }, [
    { bytes:PNG, name:"a.png", type:"image/png", caption:"Sue and Coach Miller" },
    { bytes:PNG, name:"b.png", type:"image/png", caption:"" },
    { bytes:PNG, name:"c.png", type:"image/png", caption:"The whole back row" },
  ]));
  let body = await r.json();
  ok(body.saved === 3, "3 photos saved");

  const m = await Promise.all(body.photos.map(p => capOf(p.id)));
  ok(m[0].caption === "Sue and Coach Miller", `photo 1 keeps its own caption -> "${m[0].caption}"`);
  ok(m[1].caption === "Table 4 all night", `uncaptioned photo falls back to the shared one -> "${m[1].caption}"`);
  ok(m[2].caption === "The whole back row", `photo 3 keeps its own caption -> "${m[2].caption}"`);
  ok(m.every(x => x.name === "Janet W."), "the name still applies to the whole batch");

  // The alignment case that matters: a rejected file in the middle must not
  // shift every later caption onto the wrong photo.
  r = await upload(post({ name:"Mike D.", caption:"fallback" }, [
    { bytes:PNG, name:"good1.png", type:"image/png", caption:"FIRST" },
    { bytes:Buffer.from("not an image at all, just text"), name:"junk.txt", type:"text/plain", caption:"JUNK" },
    { bytes:PNG, name:"good2.png", type:"image/png", caption:"THIRD" },
  ]));
  body = await r.json();
  ok(body.saved === 2 && body.rejected.length === 1, "2 saved, 1 rejected");
  const m2 = await Promise.all(body.photos.map(p => capOf(p.id)));
  ok(m2[0].caption === "FIRST", `first surviving photo keeps FIRST -> "${m2[0].caption}"`);
  ok(m2[1].caption === "THIRD",
     `caption does NOT slide onto the wrong photo when one is rejected -> "${m2[1].caption}"`);

  // A caption longer than the limit is trimmed, not rejected.
  r = await upload(post({ name:"X", caption:"c" }, [
    { bytes:PNG, name:"long.png", type:"image/png", caption:"z".repeat(400) },
  ]));
  const m3 = await capOf((await r.json()).photos[0].id);
  ok(m3.caption.length === 300, `over-long caption trimmed to 300 (got ${m3.caption.length})`);
}

console.log(`\n${n - fail}/${n} passed` + (fail ? ` — ${fail} FAILURES` : ""));
process.exit(fail ? 1 : 0);
