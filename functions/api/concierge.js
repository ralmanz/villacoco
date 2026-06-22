/**
 * Villa Coco — Concierge Bot proxy
 * Deploy to: functions/api/concierge.js   →   route POST /api/concierge
 *
 * Public, UNauthenticated endpoint. Security = rate limiting + input caps,
 * NOT the admin password. The Anthropic key stays server-side and never
 * reaches the browser.
 *
 * Requires:
 *   - env.ANTHROPIC_API_KEY   (Pages secret; same one the admin AI uses)
 *   - env.VILLA_COCO_CMS       (KV binding; used for live facts + rate limit + logs)
 * Optional:
 *   - env.ANTHROPIC_MODEL              (default below — current cheapest Haiku)
 *   - env.ALLOWED_ORIGINS              (comma-separated; mirrors cms.js behavior)
 *   - env.CONCIERGE_RATE_LIMIT_PER_MIN (default 15, per IP)
 *   - env.CONCIERGE_LOG                ("false" to disable conversation logging)
 *   - env.CONCIERGE_LOG_TTL_DAYS       (default 60; auto-expires logged chats)
 */

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 600;
const MAX_HISTORY_TURNS = 20;   // cap messages sent to the model (cost guard)
const MAX_MSG_CHARS = 2000;     // cap per-message length (abuse guard)

/* ============================================================
   KNOWLEDGE BASE — edit this with Olivia's real details.
   This is the source of truth. Live values pulled from the CMS
   (cms_current) are appended at request time and take priority
   for anything they cover (rooms, etc.).
   ============================================================ */
const KNOWLEDGE_BASE = `You are "Coco", the friendly digital concierge for Villa Coco, a boutique beachfront property in Panama. You help guests warmly, briefly, and accurately.

LANGUAGE: Detect the language the guest writes in and always reply in that same language (English, Spanish, French, etc.).

STYLE: Warm and concise, like an attentive host. Keep replies short. Don't over-explain.

WHAT YOU KNOW (sample details — replace with real information):
- About: Villa Coco is a boutique beachfront villa in [AREA], Panama, ideal for couples and small families.
- Check-in: 3:00 PM. Check-out: 11:00 AM. Early check-in or late check-out may be possible on request, subject to availability.
- Capacity: sleeps up to [6] guests across [3] bedrooms.
- Amenities: high-speed WiFi, air conditioning, private pool, fully equipped kitchen, direct beach access, free on-site parking, beach towels and chairs provided.
- House rules: no smoking indoors, quiet hours after 10:00 PM, no parties or events without prior approval, pets on request only.
- Getting there: about [X] from Panama City. A trusted private transfer can be arranged on request.
- Nearby: local restaurants within walking distance (fresh seafood is the specialty), a calm swimming beach a couple of minutes away, and a surf beach a short drive away.

BOOKING INQUIRIES: You cannot confirm reservations or take payments yourself. When a guest wants to book or asks about availability for specific dates: collect their desired dates, number of guests, and a contact (name plus email or WhatsApp), warmly confirm you've noted the request, and let them know the host will follow up shortly to confirm and arrange payment. Never say a booking is confirmed.

HONESTY: Only use the details you have. If a guest asks something you don't have an answer to, say you'll pass the question to the host rather than guessing. Never invent specifics about the property.`;

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

// Live facts from cms_current. Guarded reads; returns "" if KV empty or parse fails.
async function liveContext(env) {
  try {
    if (!env.VILLA_COCO_CMS) return "";
    const raw = await env.VILLA_COCO_CMS.get("cms_current");
    if (!raw) return "";
    const cms = JSON.parse(raw);
    const parts = [];

    // CMS room shape: { name, tag, feat, img }
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

/* ---------- handlers ---------- */

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: corsHeaders(context.request, context.env) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = corsHeaders(request, env);

  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "Concierge is not configured." }, 500, cors);
  }

  // Rate limit
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const limit = parseInt(env.CONCIERGE_RATE_LIMIT_PER_MIN || "15", 10);
  if (!(await withinRateLimit(env, ip, limit))) {
    return json({ error: "Too many messages — please wait a moment." }, 429, cors);
  }

  // Parse + validate
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
  const sessionId =
    typeof payload?.sessionId === "string" && payload.sessionId.length <= 64
      ? payload.sessionId
      : crypto.randomUUID();
  const visitorId =
    typeof payload?.visitorId === "string" ? payload.visitorId.slice(0, 64) : null;

  const system = KNOWLEDGE_BASE + (await liveContext(env));

  // Call Anthropic
  let reply;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("Anthropic error", res.status, detail);
      return json({ error: "The concierge is unavailable right now." }, 502, cors);
    }
    const data = await res.json();
    reply = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  } catch (e) {
    console.error("Concierge fetch failed", e);
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
