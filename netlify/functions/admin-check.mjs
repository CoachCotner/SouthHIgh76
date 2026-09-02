import { timingSafeEqual } from "node:crypto";
import { json } from "./_lib.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const adminPassword = process.env.REUNION_ADMIN_PASSWORD;
  if (!adminPassword) {
    return json({ error: "No admin password is set on the site yet." }, 503);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  const given = Buffer.from(String(body?.password || ""));
  const expected = Buffer.from(adminPassword);
  const ok = given.length === expected.length && timingSafeEqual(given, expected);

  return json({ ok }, ok ? 200 : 403);
};

export const config = { path: "/api/admin-check" };
