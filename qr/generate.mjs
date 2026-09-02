// Regenerates the reunion photo-wall QR codes and the printable table tents.
//   node qr/generate.mjs [url]
// Defaults to the live photo wall. Pass a URL to point everything somewhere
// else (a Netlify preview deploy, say) without editing this file.
//
// The printable sign is generated here too, with the QR inlined into it, so
// the code on the tents can never drift out of sync with the code files.
import QRCode from "qrcode";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const target = process.argv[2] || "https://photos.southhigh76.com";
const label = target.replace(/^https?:\/\//, "").replace(/\/$/, "");
const out = dirname(fileURLToPath(import.meta.url));

// Error correction "H" recovers from 30% damage, so the code still scans off a
// table tent that's been creased, spilled on, or photographed at an angle from
// across a dim room.
const base = { errorCorrectionLevel: "H", margin: 2 };
const GREEN = "#0F3E07"; // the site's primary school green
const green = { dark: GREEN, light: "#ffffff" };

const svg = await QRCode.toString(target, { ...base, type: "svg", color: green, width: 1000 });
writeFileSync(join(out, "reunion-photos-qr.svg"), svg);

await QRCode.toFile(join(out, "reunion-photos-qr.png"), target, { ...base, color: green, width: 2000 });
await QRCode.toFile(join(out, "reunion-photos-qr-black.png"), target, {
  ...base,
  color: { dark: "#000000", light: "#ffffff" },
  width: 2000,
});

// --- printable table tents -------------------------------------------------

const qrPath = svg.match(/<path stroke[^>]*\/>/)[0];

const card = `<div class="card">
    <div class="kicker">South High &middot; Class of 1976</div>
    <h1>Share your photos</h1>
    <div class="sub">Point your phone camera at the code &mdash; your pictures go straight up on the reunion photo wall.</div>
    <svg class="qr" viewBox="0 0 37 37" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
      <path fill="#ffffff" d="M0 0h37v37H0z"/>
      ${qrPath}
    </svg>
    <div class="url">${label}</div>
    <div class="steps">No app, no sign-up &middot; See everyone else&rsquo;s photos too</div>
  </div>`;

writeFileSync(join(out, "print-signs.html"), `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reunion Photo Wall — Printable Signs</title>
<style>
:root{--green:${GREEN};--green-deep:#093F01;--mint:#E8F3E0}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Georgia,"Times New Roman",serif;background:#DDEAD3;color:#16210F}

.hint{max-width:760px;margin:24px auto;padding:16px 20px;background:#fff;border-left:4px solid var(--green);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px;line-height:1.6;border-radius:6px}
.hint strong{display:block;margin-bottom:4px;font-size:15px}

/* Two cards per portrait Letter page — cut across the middle for table tents. */
.page{width:8.5in;height:11in;margin:20px auto;background:#fff;display:flex;flex-direction:column;
  box-shadow:0 4px 24px rgba(15,62,7,.18)}
.card{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;padding:0.5in 0.6in;position:relative}
.card + .card{border-top:2px dashed #B9D3A6}

.kicker{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:11pt;
  letter-spacing:.18em;text-transform:uppercase;color:var(--green-deep);font-weight:700;margin-bottom:6px}
h1{font-size:30pt;color:var(--green);line-height:1.1;margin-bottom:8px}
.sub{font-size:13pt;color:#3d4a36;margin-bottom:16px;max-width:5in}
.qr{width:2.5in;height:2.5in;border:10px solid #fff;outline:1px solid #D3E5C6}
.url{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:12pt;font-weight:700;
  color:var(--green);margin-top:14px;letter-spacing:.01em}
.steps{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:10pt;color:#5F6B58;margin-top:8px}

@media print{
  body{background:#fff}
  .hint{display:none}
  .page{margin:0;box-shadow:none;width:auto;height:auto;page-break-after:always}
  .card{height:5.5in}
  @page{size:letter portrait;margin:0.25in}
}
</style>
</head>
<body>

<div class="hint">
  <strong>How to use this sheet</strong>
  Print on regular Letter paper (portrait). You get two identical cards per page — cut along the dashed
  line and fold or stand them on the tables. Print as many pages as you need tents. The QR is vector, so
  it stays sharp at any size. Check "Background graphics" in your print dialog so the green shows up.
</div>

<div class="page">
  ${card}
  ${card}
</div>

</body>
</html>
`);

console.log("QR codes and print signs point to:", target);
