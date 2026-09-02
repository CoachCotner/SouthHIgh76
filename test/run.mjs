// Runs every suite in one go: node --import ./test/register.mjs test/run.mjs
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
let failed = 0;
for (const suite of ["fmt.mjs", "e2e.mjs", "paging.mjs"]) {
  console.log(`\n──────── ${suite} ────────`);
  const r = spawnSync(process.execPath,
    ["--import", join(here, "register.mjs"), join(here, suite)], { stdio: "inherit" });
  if (r.status !== 0) failed++;
}
console.log(failed ? `\n${failed} suite(s) FAILED` : "\nAll suites passed.");
process.exit(failed ? 1 : 0);
