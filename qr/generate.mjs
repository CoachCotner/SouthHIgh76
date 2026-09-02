// Regenerates the reunion photo-wall QR codes.
//   node qr/generate.mjs [url]
// Defaults to the live photo wall. Pass a URL to point the codes somewhere
// else (a Netlify preview deploy, say) without editing this file.
import QRCode from "qrcode";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const target = process.argv[2] || "https://southhigh76.com/photos";
const out = dirname(fileURLToPath(import.meta.url));

// Error correction "H" recovers from 30% damage, so the code still scans off a
// table tent that's been creased, spilled on, or photographed at an angle from
// across a dim room.
const base = { errorCorrectionLevel: "H", margin: 2 };
const navy = { dark: "#12305c", light: "#ffffff" };

const svg = await QRCode.toString(target, { ...base, type: "svg", color: navy, width: 1000 });
writeFileSync(join(out, "reunion-photos-qr.svg"), svg);

await QRCode.toFile(join(out, "reunion-photos-qr.png"), target, { ...base, color: navy, width: 2000 });
await QRCode.toFile(join(out, "reunion-photos-qr-black.png"), target, {
  ...base,
  color: { dark: "#000000", light: "#ffffff" },
  width: 2000,
});

console.log("QR codes point to:", target);
