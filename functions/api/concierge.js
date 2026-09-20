/**
 * Villa Coco — Concierge Bot proxy
 * Deploy to: functions/api/concierge.js   →   route POST /api/concierge
 *
 * Public, UNauthenticated endpoint. Security = rate limiting + input caps,
 * NOT the admin password. The OpenAI key stays server-side and never
 * reaches the browser.
 *
 * Requires:
 *   - env.OPENAI_API_KEY       (Pages secret)
 *   - env.VILLA_COCO_CMS       (KV binding; live facts + rate limit + logs)
 * Optional:
 *   - env.OPENAI_MODEL                 (default gpt-5.6-luna)
 *   - env.ALLOWED_ORIGINS              (comma-separated; mirrors cms.js)
 *   - env.CONCIERGE_RATE_LIMIT_PER_MIN (default 15, per IP)
 *   - env.CONCIERGE_LOG                ("false" to disable conversation logging)
 *   - env.CONCIERGE_LOG_TTL_DAYS       (default 60; auto-expires logged chats)
 */

const DEFAULT_MODEL = "gpt-5.6-luna";
const MAX_TOKENS = 600;
const MAX_HISTORY_TURNS = 20;   // cap messages sent to the model (cost guard)
const MAX_MSG_CHARS = 2000;     // cap per-message length (abuse guard)
const PROVIDER_TIMEOUT_MS = 20000;

/* ============================================================
   KNOWLEDGE BASE
   Only confirmed behavioral rules and property facts that are
   already public on the live site. Live CMS values are appended
   at request time and take priority when present.
   ============================================================ */
const KNOWLEDGE_BASE = `You are "Coco", the friendly digital concierge for Villa Coco, a boutique hotel in Santa Catalina, Veraguas, on Panama's Pacific coast. You help guests warmly, briefly, and accurately.

LANGUAGE: Detect the language the guest writes in and always reply in that same language (English, Spanish, French, etc.).

STYLE: Warm and concise, like an attentive host. Keep replies short. Don't over-explain.

CONFIRMED FACTS:
- Villa Coco is a family-run boutique hotel in Santa Catalina, Panama.
- It has an infinity pool and a restaurant called Ai Mamita.
- Current rooms, restaurant hours, packages, and contact details may appear in the LIVE DETAILS section. Prefer those when present.

BOOKING INQUIRIES: You cannot confirm reservations or take payments yourself. When a guest wants to book or asks about availability for specific dates: use the official booking link from LIVE DETAILS if one is provided; also collect their desired dates, number of guests, and a contact (name plus email or WhatsApp). Warmly confirm you've noted the request and that the host will follow up to confirm and arrange payment. Never say a booking is confirmed.

RETREATS: Villa Coco sometimes hosts yoga and wellness retreats. If a guest is interested, point them to https://villacoco.pages.dev/retreat/ or to WhatsApp from LIVE DETAILS. Do not quote retreat dates, prices, capacity, or facilitator names unless those exact details appear in LIVE DETAILS. If they do not, say you do not have those details and offer to connect the guest with the host.

UNKNOWN INFORMATION:
- If a guest asks something that is not in these instructions or LIVE DETAILS, say you do not have that answer and offer to pass the question to the host using the WhatsApp number or email from LIVE DETAILS.
- Never invent rooms, prices, distances, travel times, amenities, house rules, check-in or check-out times, guest capacity, or retreat specifics.
- Never use placeholder text such as [AREA], [X], or any other bracketed sample values.

HONESTY: Only use the details you have. Never invent specifics about the property.`;

/* ---------- helpers ---------- */

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let allowOrigin = "*";
  if (allowed.length) {
    allowOrigin = allowed.includes(origin) ? origin : allowed[0];
  }
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

function stripTags(s) {
  return String(s).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function resolveModel(env) {
  const configured = typeof env.OPENAI_MODEL === "string" ? env.OPENAI_MODEL.trim() : "";
  return configured || DEFAULT_MODEL;
}

function extractResponseText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }
  const parts = [];
  const output = Array.isArray(data?.output) ? data.output : [];
  for (const item of output) {
    if (typeof item?.text === "string" && item.text.trim()) parts.push(item.text);
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const block of content) {
      if (typeof block?.text === "string" && block.text.trim()) parts.push(block.text);
    }
  }
  return parts.join("\n").trim();
}

// KV-based rate limit. Note: KV is eventually consistent, so this is
// approximate under bursts — fine here, because the API spend cap is the
// real backstop. Fails OPEN if KV is unavailable.
async function withinRateLimit(env, ip, limit) {
  if (!env.VILLA_COCO_CMS || !ip) return true;
  try {
    const minute = Math.floor(Date.now() / 60000);
    const key = `bot:rate:${await sha256(ip)}:${minute}`;
    const current = parseInt((await env.VILLA_COCO_CMS.get(key)) || "0", 10);
    if (current >= limit) return false;
    await env.VILLA_COCO_CMS.put(key, String(current + 1), { expirationTtl: 120 });
    return true;
  } catch (_) {
    return true;
  }
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

// Live facts from cms_current. Guarded reads; returns "" if KV empty or parse fails.
async function liveContext(env) {
  try {
    if (!env.VILLA_COCO_CMS) return "";
    const raw = await env.VILLA_COCO_CMS.get("cms_current");
    if (!raw) return "";
    const cms = JSON.parse(raw);
    const parts = [];

    if (Array.isArray(cms.rooms)) {
      const rooms = cms.rooms
        .slice(0, 12)
        .map((r) => {
          const name = r?.name;
          if (!name) return null;
          const bits = [];
          if (r?.tag) bits.push(stripTags(r.tag));
          if (r?.feat) bits.push(stripTags(Array.isArray(r.feat) ? r.feat.join(", ") : String(r.feat)));
          return `- ${name}${bits.length ? `: ${bits.join(" — ").slice(0, 220)}` : ""}`;
        })
        .filter(Boolean);
      if (rooms.length) parts.push("Current rooms / accommodations:\n" + rooms.join("\n"));
    }

    const about = cms?.hero?.sub;
    if (about) parts.push("About: " + stripTags(about).slice(0, 400));

    const story = cms?.story?.body;
    if (story) parts.push("More about the property: " + stripTags(story).slice(0, 600));

    if (Array.isArray(cms.hours) && cms.hours.length) {
      const hours = cms.hours
        .slice(0, 12)
        .map((h) => {
          const service = stripTags(h?.service || "");
          if (!service) return null;
          if (h?.closed) return `- ${service}: Closed`;
          const open = stripTags(h?.open || "");
          const close = stripTags(h?.close || "");
          if (!open || !close) return null;
          return `- ${service}: ${open} – ${close}`;
        })
        .filter(Boolean);
      if (hours.length) {
        const note = cms.hoursNote ? `\nNote: ${stripTags(cms.hoursNote).slice(0, 160)}` : "";
        parts.push("Restaurant / service hours:\n" + hours.join("\n") + note);
      }
    }

    if (Array.isArray(cms.packages) && cms.packages.length) {
      const pkgs = cms.packages
        .slice(0, 8)
        .map((p) => {
          const name = stripTags(p?.name || "");
          if (!name) return null;
          const bits = [];
          if (p?.for) bits.push(stripTags(p.for));
          if (p?.price) bits.push("from $" + stripTags(String(p.price)));
          return `- ${name}${bits.length ? ` (${bits.join(", ")})` : ""}`;
        })
        .filter(Boolean);
      if (pkgs.length) parts.push("Current packages:\n" + pkgs.join("\n"));
    }

    const settings = cms.settings && typeof cms.settings === "object" ? cms.settings : {};
    const contact = [];
    if (settings.bookingUrl) contact.push("Official booking link: " + stripTags(settings.bookingUrl).slice(0, 240));
    if (settings.email) contact.push("Email: " + stripTags(settings.email).slice(0, 120));
    if (settings.phone) contact.push("Phone: " + stripTags(settings.phone).slice(0, 40));
    const waDigits = digitsOnly(settings.whatsapp);
    if (waDigits) contact.push("WhatsApp: https://wa.me/" + waDigits);
    if (contact.length) parts.push("Guest contact / booking:\n" + contact.join("\n"));

    if (!parts.length) return "";
    return (
      "\n\nLIVE DETAILS FROM THE SITE (prefer these for current specifics; " +
      "if they conflict with the static info above, these win):\n" +
      parts.join("\n\n")
    );
  } catch (_) {
    return "";
  }
}

function sanitizeMessages(input) {
  if (!Array.isArray(input)) return null;
  let msgs = input
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MSG_CHARS) }))
    .filter((m) => m.content.trim().length > 0);

  // Must start with a user turn (drop any leading assistant/welcome messages).
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  // Keep only the most recent turns.
  if (msgs.length > MAX_HISTORY_TURNS) msgs = msgs.slice(-MAX_HISTORY_TURNS);
  // Must end on a user turn.
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return null;
  return msgs;
}

function toOpenAIInput(messages) {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

/* ---------- handlers ---------- */

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: corsHeaders(context.request, context.env) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = corsHeaders(request, env);

  // Parse + validate first so bad requests do not consume the rate budget.
  let payload;
  try {
    payload = await request.json();
  } catch (_) {
    return json({ error: "Invalid request." }, 400, cors);
  }
  const messages = sanitizeMessages(payload?.messages);
  if (!messages) {
    return json({ error: "No valid message to answer." }, 400, cors);
  }

  if (!env.OPENAI_API_KEY) {
    console.error("Concierge misconfigured: missing OPENAI_API_KEY");
    return json({ error: "The concierge is unavailable right now." }, 500, cors);
  }

  // Rate limit
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const limit = parseInt(env.CONCIERGE_RATE_LIMIT_PER_MIN || "15", 10);
  if (!(await withinRateLimit(env, ip, limit))) {
    return json({ error: "Too many messages — please wait a moment." }, 429, cors);
  }
  const sessionId =
    typeof payload?.sessionId === "string" && payload.sessionId.length <= 64
      ? payload.sessionId
      : crypto.randomUUID();
  const visitorId =
    typeof payload?.visitorId === "string" ? payload.visitorId.slice(0, 64) : null;

  const instructions = KNOWLEDGE_BASE + (await liveContext(env));

  let reply;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    let res;
    try {
      res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: "Bearer " + env.OPENAI_API_KEY,
        },
        body: JSON.stringify({
          model: resolveModel(env),
          instructions,
          input: toOpenAIInput(messages),
          max_output_tokens: MAX_TOKENS,
          reasoning: { effort: "low" },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      console.error("OpenAI concierge error", res.status);
      return json({ error: "The concierge is unavailable right now." }, 502, cors);
    }
    const data = await res.json();
    reply = extractResponseText(data);
  } catch (e) {
    const timedOut = e && (e.name === "AbortError" || e.name === "TimeoutError");
    console.error(timedOut ? "OpenAI concierge timeout" : "OpenAI concierge fetch failed");
    return json({ error: "The concierge is unavailable right now." }, 502, cors);
  }

  if (!reply) reply = "Sorry, I didn't catch that — could you rephrase?";

  // Log the conversation (auto-expiring). Never let logging break the reply.
  if (env.CONCIERGE_LOG !== "false" && env.VILLA_COCO_CMS) {
    const ttlDays = Math.max(1, parseInt(env.CONCIERGE_LOG_TTL_DAYS || "60", 10));
    const record = {
      sessionId,
      visitorId,
      updatedAt: new Date().toISOString(),
      turns: [...messages, { role: "assistant", content: reply }].slice(-40),
    };
    context.waitUntil(
      env.VILLA_COCO_CMS.put(`bot:session:${sessionId}`, JSON.stringify(record), {
        expirationTtl: ttlDays * 86400,
      }).catch(() => {})
    );
  }

  return json({ reply, sessionId }, 200, cors);
}

// Anything other than POST/OPTIONS
export async function onRequest(context) {
  return json({ error: "Method not allowed." }, 405, corsHeaders(context.request, context.env));
}
