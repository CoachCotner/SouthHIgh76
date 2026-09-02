import { detectFormat } from "../netlify/functions/_lib.mjs";
import { IMAGES } from "./fixtures.mjs";


let fail = 0, n = 0;
const ok = (c,m) => { n++; if(!c){ console.log("  FAIL:", m); fail++; } else console.log("  pass:", m); };

console.log("Real files produced by an encoder:");
for (const [file, ext, displayable] of [
  ["real.jpg","jpg",true], ["real.png","png",true], ["real.webp","webp",true],
  ["real.gif","gif",true], ["real.avif","avif",true],
]) {
  const f = detectFormat(Buffer.from(IMAGES[file], "base64"));
  ok(f && f.ext === ext && f.displayable === displayable, `${file} -> ${f ? f.ext : "null"}`);
}

// ftyp box: [size][ftyp][major brand][minor version][...compatible brands]
function ftyp(major, compatible = []) {
  const size = 16 + compatible.length * 4;
  const b = Buffer.alloc(Math.max(size, 64));
  b.writeUInt32BE(size, 0);
  b.write("ftyp", 4, "ascii");
  b.write(major, 8, "ascii");
  b.writeUInt32BE(0, 12);
  compatible.forEach((c, i) => b.write(c, 16 + i * 4, "ascii"));
  return b.buffer;
}

console.log("\nHEIC/HEIF as real phones actually write it:");
ok(detectFormat(ftyp("heic", ["heic","mif1","miaf"]))?.ext === "heic", "iPhone: major brand heic");
ok(detectFormat(ftyp("mif1", ["mif1","heic","miaf"]))?.ext === "heic", "Samsung/generic HEIF: major mif1, heic only as a compatible brand");
ok(detectFormat(ftyp("heix", ["heix","heic"]))?.ext === "heic", "heix (10-bit iPhone)");
ok(detectFormat(ftyp("msf1", ["msf1","hevc"]))?.ext === "heic", "msf1 image sequence (Live Photo still)");
ok(detectFormat(ftyp("heic"))?.displayable === false, "HEIC is flagged not-directly-displayable");
ok(detectFormat(ftyp("avif", ["avif","mif1"]))?.ext === "avif", "AVIF still wins over the mif1 compatible brand");
ok(detectFormat(ftyp("avis", ["avis","avif"]))?.ext === "avif", "avis sequence");

console.log("\nThings that must be rejected:");
for (const [label, buf] of [
  ["a text file", Buffer.alloc(64, 0x41).buffer],
  ["an MP4 video", ftyp("isom", ["isom","mp42"])],
  ["a QuickTime movie", ftyp("qt  ", ["qt  "])],
  ["a PDF", Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(56)]).buffer],
  ["a ZIP", Buffer.concat([Buffer.from("PK\x03\x04"), Buffer.alloc(60)]).buffer],
  ["an ELF binary", Buffer.concat([Buffer.from([0x7f,0x45,0x4c,0x46]), Buffer.alloc(60)]).buffer],
  ["a truncated file", Buffer.alloc(4).buffer],
]) ok(detectFormat(buf) === null, `rejects ${label}`);

console.log("\nMIME type is ignored entirely:");
const jpg = Buffer.from(IMAGES["real.jpg"], "base64");
ok(detectFormat(jpg)?.mime === "image/jpeg", "real JPEG identified regardless of what the phone declared");
ok(detectFormat(ftyp("heic",["heic"]))?.mime === "image/heic", "HEIC with an empty declared MIME still identified");

console.log(`\n${n-fail}/${n} passed` + (fail ? " — FAILURES" : ""));
process.exit(fail ? 1 : 0);
