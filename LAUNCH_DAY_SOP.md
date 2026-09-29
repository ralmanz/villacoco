# Villa Coco — Domain Cutover Checklist

Production apex: **https://villacocopanama.com** (no www).  
Interim host: **https://villacoco.zeli.lat** (noindex until cutover).

Cutover requires **env var + DNS/dashboard changes only** — no code deploy for the domain switch.

---

## A) Before cutover (interim — zeli.lat live)

### Cloudflare Pages project `villacoco`

**Environment variables (Production + Preview):**

| Variable | Interim value | After cutover |
|----------|---------------|---------------|
| `PUBLIC_SITE_URL` | `https://villacoco.zeli.lat` | `https://villacocopanama.com` |
| `ALLOWED_ORIGINS` | `https://villacoco.zeli.lat` | `https://villacocopanama.com,https://www.villacocopanama.com` |
| `ADMIN_PASSWORD` | *(set)* | unchanged |
| `OPENAI_API_KEY` | *(set)* | unchanged |

**Bindings:** `VILLA_COCO_CMS` (KV), `VILLA_COCO_MEDIA` (R2).

**Custom domains on Pages:** attach `villacoco.zeli.lat` (interim).

### Interim noindex (temporary hosts)

Cloudflare Pages `_headers` is path-only. Use **Transform Rules** on the zone(s) that serve interim traffic:

| When incoming requests match… | Then set response header… |
|-------------------------------|---------------------------|
| Hostname equals `villacoco.pages.dev` | `X-Robots-Tag` = `noindex` |
| Hostname wildcard `*.villacoco.pages.dev` | `X-Robots-Tag` = `noindex` |
| Hostname equals `villacoco.zeli.lat` | `X-Robots-Tag` = `noindex` |

Also covered in code: `functions/_middleware.js` on routed paths; `/panel` has `<meta name="robots" content="noindex, nofollow">`.

**Remove** the zeli.lat Transform Rule after cutover (production must be indexable).

### Smoke test (zeli.lat)

- [ ] `https://villacoco.zeli.lat/` loads
- [ ] `https://villacoco.zeli.lat/panel` login + save works
- [ ] `view-source:` shows canonical = `https://villacoco.zeli.lat/` (matches `PUBLIC_SITE_URL`)
- [ ] `/sitemap.xml` and `/robots.txt` use `PUBLIC_SITE_URL`
- [ ] `/api/cms?action=health` returns JSON
- [ ] Coco concierge responds on `/`

---

## B) Cloudflare zone prep (villacocopanama.com)

### 1) Zone + DNS records

- [ ] Add domain to Cloudflare (or confirm zone active)
- [ ] Import/copy DNS from GoDaddy; verify **email records** (MX, SPF, DKIM, autodiscover, etc.)
- [ ] Set **email-related records to DNS only (grey cloud)** — do not proxy mail through Cloudflare
- [ ] Confirm web A/CNAME targets match Cloudflare Pages instructions before nameserver switch

### 2) GoDaddy nameserver change

- [ ] Replace GoDaddy nameservers with Cloudflare-assigned nameservers
- [ ] Wait for propagation (minutes to hours)

### 3) Attach domains in Pages

Pages → `villacoco` → **Custom domains**:

- [ ] `villacocopanama.com` (apex)
- [ ] `www.villacocopanama.com`

### 4) Redirect Rules (zone: villacocopanama.com)

| Rule | Action |
|------|--------|
| Host equals `www.villacocopanama.com` | 301 redirect to `https://villacocopanama.com${uri}` |
| Host equals `villacoco.zeli.lat` | 301 redirect to `https://villacocopanama.com${uri}` *(enable at cutover)* |

Keep zeli.lat redirect in place until marketing materials are updated, then optional.

---

## C) Cutover moment (env only)

In Pages → Settings → Environment variables → **Production**:

1. Set `PUBLIC_SITE_URL` = `https://villacocopanama.com`
2. Set `ALLOWED_ORIGINS` = `https://villacocopanama.com,https://www.villacocopanama.com`
3. Redeploy not required if vars are runtime-bound; trigger redeploy if your project caches env at build time

Remove/disable:

- [ ] Transform Rule: noindex on `villacoco.zeli.lat`
- [ ] (Optional) zeli.lat → apex redirect once interim links expire

---

## D) Post-cutover verification

### DNS & SSL

- [ ] `https://villacocopanama.com` loads (valid SSL)
- [ ] `https://www.villacocopanama.com` 301s to apex
- [ ] No redirect loops

### SEO source (critical)

```bash
curl -s "https://villacocopanama.com/" | grep -E 'canonical|og:url|"url"'
curl -s "https://villacocopanama.com/sitemap.xml"
curl -s "https://villacocopanama.com/robots.txt"
```

Expect:

- `<link rel="canonical" href="https://villacocopanama.com/">`
- `<meta property="og:url" content="https://villacocopanama.com/">`
- JSON-LD `"url": "https://villacocopanama.com"`
- Sitemap + robots `Sitemap:` use `https://villacocopanama.com`

Quick CMS proof: change SEO title in `/panel`, save, re-check view-source.

### App smoke test

- [ ] `/panel` login, save, revert
- [ ] Image upload → `/media/...` URL
- [ ] Analytics pageview increments
- [ ] Retreat form + WhatsApp CTAs on `/retreat/`
- [ ] Coco concierge works

### Email (grey-cloud records)

- [ ] Send test to `relax@villacocopanama.com` from external mailbox
- [ ] Reply / receive path still works (MX not proxied)

### Search & social

- [ ] Google Search Console property on apex domain
- [ ] Submit `https://villacocopanama.com/sitemap.xml`
- [ ] WhatsApp / Facebook link preview shows correct OG image

---

## E) Rollback

If critical failure after DNS switch:

1. Repoint GoDaddy nameservers to previous DNS (temporary), **or**
2. Revert `PUBLIC_SITE_URL` / `ALLOWED_ORIGINS` to zeli.lat values and route traffic back to interim domain

Keep previous WordPress/host available 1–2 weeks; do not delete until stable.

---

## F) Owner handoff

Share securely:

- Production URL: `https://villacocopanama.com`
- Content panel: `https://villacocopanama.com/panel`
- `OWNER_MEDIA_GUIDE.md`, `WEBSITE_INTELLIGENCE.md`, `CLOUDFLARE_BACKEND_SETUP.md`

---

## G) Sign-off

- [ ] Apex live on Cloudflare Pages with correct env vars
- [ ] www → apex redirect active
- [ ] Email DNS intact (grey cloud)
- [ ] Canonical / sitemap / robots use `PUBLIC_SITE_URL`
- [ ] Panel publish + media upload work
- [ ] Interim hosts noindex (or redirected) as intended
