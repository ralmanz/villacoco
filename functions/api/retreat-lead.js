/**
 * Villa Coco — Retreat lead capture
 * Deploy to: functions/api/retreat-lead.js   →   route POST /api/retreat-lead
 *
 * Public, unauthenticated. Stores leads in KV under `lead:retreat:`.
 * Leads are kept (no TTL) — they're the whole point of the campaign.
 *
 * Uses: env.VILLA_COCO_CMS (KV). Optional: env.ALLOWED_ORIGINS.
 * Read them later with an admin tool, or `wrangler kv key list`.
 */

const MAX = { name: 120, email: 160, dates: 200, message: 1200 };

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  let allowOrigin = "*";
  if (allowed.length) allowOrigin = allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Lighter limit than the bot — a person submits a form once, not 15x/min.
async function withinRateLimit(env, ip, limit) {
  if (!env.VILLA_COCO_CMS || !ip) return true;
  try {
    const minute = Math.floor(Date.now() / 60000);
    const key = `bot:rate:lead:${await sha256(ip)}:${minute}`;
    const current = parseInt((await env.VILLA_COCO_CMS.get(key)) || "0", 10);
    if (current >= limit) return false;
    await env.VILLA_COCO_CMS.put(key, String(current + 1), { expirationTtl: 120 });
    return true;
  } catch (_) {
    return true;
  }
}

const clean = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: corsHeaders(context.request, context.env) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = corsHeaders(request, env);

  const ip = request.headers.get("CF-Connecting-IP") || "";
  if (!(await withinRateLimit(env, ip, 5))) {
    return json({ error: "Please wait a moment before submitting again." }, 429, cors);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Invalid request." }, 400, cors);
  }

  // Honeypot: if a bot filled the hidden "website" field, pretend success and drop.
  if (typeof body?.website === "string" && body.website.trim()) {
    return json({ ok: true }, 200, cors);
  }

  const name = clean(body?.name, MAX.name);
  const email = clean(body?.email, MAX.email);
  if (name.length < 2 || !validEmail(email)) {
    return json({ error: "Please enter a name and a valid email." }, 400, cors);
  }

  const lead = {
    name,
    email,
    dates: clean(body?.dates, MAX.dates),
    message: clean(body?.message, MAX.message),
    utm: body?.utm && typeof body.utm === "object" ? body.utm : {},
    page: clean(body?.page, 40) || "retreat",
    ip: ip ? await sha256(ip) : null, // hashed, for dedupe/abuse review — not the raw IP
    createdAt: new Date().toISOString(),
  };

  if (!env.VILLA_COCO_CMS) {
    // No store bound — don't lose the lead silently; surface a soft failure.
    console.error("retreat-lead: VILLA_COCO_CMS not bound; lead not stored", lead.email);
    return json({ error: "Couldn't save right now — please message us on WhatsApp." }, 503, cors);
  }

  const date = lead.createdAt.slice(0, 10);
  const id = crypto.randomUUID();
  try {
    await env.VILLA_COCO_CMS.put(`lead:retreat:${date}:${id}`, JSON.stringify(lead));
  } catch (e) {
    console.error("retreat-lead: KV put failed", e);
    return json({ error: "Couldn't save right now — please message us on WhatsApp." }, 503, cors);
  }

  return json({ ok: true, id }, 200, cors);
}

export async function onRequest(context) {
  return json({ error: "Method not allowed." }, 405, corsHeaders(context.request, context.env));
}
