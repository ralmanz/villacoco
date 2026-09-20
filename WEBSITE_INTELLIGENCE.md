# Villa Coco Website Intelligence (Single Source of Truth)

This document is the operational brain for the Villa Coco website.
Use it for ownership handoff, deployment, troubleshooting, and future updates.

---

## 1) Project Snapshot

- **Primary production Pages project:** `villacoco`
- **Primary preview domain:** `https://villacoco.pages.dev`
- **Tech stack:** static HTML/CSS/JS + Cloudflare Pages Functions + Cloudflare KV
- **Content management:** custom admin panel at `/admin`
- **Live content storage:** KV key `cms_current`
- **Analytics storage:** KV key `cms_analytics`

---

## 2) Repo Structure

- `index.html` -> main website frontend
- `admin/index.html` -> CMS admin panel
- `functions/api/cms.js` -> CMS API (auth, save, revert, analytics, R2 uploads)
- `functions/media/[[key]].js` -> public R2 media delivery (`GET`/`HEAD` `/media/<key>`)
- `functions/[[path]].js` -> server-side SEO HTML injection for homepage
- `_redirects` -> admin routing
- `_routes.json` -> Pages Functions route scope
- `OWNER_MEDIA_GUIDE.md` -> owner-facing media standards
- `CLOUDFLARE_BACKEND_SETUP.md` -> Cloudflare setup instructions

---

## 3) Cloudflare Requirements

In Pages project (`villacoco`) -> Settings:

### Environment variables
- `ADMIN_PASSWORD` = admin login password
- `OPENAI_API_KEY` = Coco concierge (server-side only)
- `OPENAI_MODEL` = optional Coco model override (default `gpt-5.6-luna`)
- `ALLOWED_ORIGINS` = allowed origins (comma-separated), for example:
  - `https://villacoco.pages.dev`
  - plus custom domain(s) once launched

### Bindings
- KV binding:
  - **Variable name:** `VILLA_COCO_CMS`
  - **Value:** your KV namespace
- R2 binding:
  - **Variable name:** `VILLA_COCO_MEDIA`
  - **Value:** the Villa Coco media bucket

---

## 4) Deployment (Authoritative Command)

Always deploy to the `villacoco` project:

```bash
cd "/Users/ronelalmanza/Desktop/villacoco/project"
npx wrangler@latest pages deploy . --project-name villacoco --branch production --commit-dirty=true
```

If deploy appears in another Pages project, the wrong `--project-name` was used.

---

## 5) CMS API Endpoints

Base route attempts in admin:
- `/api/cms`
- `/functions/api/cms`
- `/.netlify/functions/cms` (fallback compatibility)

Main actions:
- `GET /api/cms` -> public content read
- `POST /api/cms` -> save content (auth required)
- `POST /api/cms?action=auth` -> login check
- `GET /api/cms?action=auth` -> login fallback for host method restrictions
- `POST /api/cms?action=revert` -> revert to backup
- `GET /api/cms?action=stats` -> analytics summary (auth required)
- `POST /api/cms?action=track` -> analytics event ingestion
- `GET /api/cms?action=health` -> health check

---

## 6) SEO Behavior (Important)

### What is implemented now
- Owner updates SEO fields in admin.
- Values are saved to KV.
- `functions/[[path]].js` injects SEO values server-side into homepage HTML for crawlers.

### Verify SEO is truly live
1. Update SEO in admin + save.
2. Open:
   - `view-source:https://villacoco.pages.dev/`
3. Confirm `<title>`, description, OG tags match admin values.

If source still shows old values, check:
- deploy target project
- KV binding
- function routes active

---

## 7) Analytics Behavior

### Tracked metrics
- Page views
- Click events (link labels)
- Estimated unique visitors (persistent browser ID)
- Device split: desktop/mobile/tablet/other
- Daily trends (Views / Users / Clicks)

### Admin analytics page
- Sidebar -> `Analytics`
- Includes:
  - total views
  - unique visitors
  - total clicks
  - clicks per view
  - mobile share
  - top pages
  - top clicked items
  - device distribution
  - last 14 days trend

Note: this is lightweight first-party analytics, not GA4-equivalent attribution/session analysis.

---

## 8) Navigation + Section Logic (Current)

Menu order:
1. Sleep
2. Wellness
3. Eat & Drink
4. Experiences
5. Packages
6. Testimonials
7. Contact

Special logic:
- Infinity Pool is no longer a standalone section.
- Infinity Pool is injected as the **first, default-active item** inside `Experiences`.

---

## 9) Media Rules (Owner Content Uploads)

See full guide: `OWNER_MEDIA_GUIDE.md`

Key policy:
- Prefer **Upload image** in admin. New files are stored as `/media/<key>` (one R2 original).
- Existing public `https://...` URLs remain valid, including previously saved remote or Cloudflare Images URLs.
- Do not store size-specific transformation URLs. Later `/cdn-cgi/image/...` wrappers can use the same `/media/<key>` source.
- Avoid preview/share pages (Dropbox/Drive).

---

## 10) Domain Launch Playbook (GoDaddy + Cloudflare Pages)

1. Keep domain at GoDaddy (registrar).
2. Add custom domains in Cloudflare Pages (`villacoco`):
   - root (`@`)
   - `www`
3. Update DNS in GoDaddy as instructed by Cloudflare.
4. Verify SSL issuance.
5. Update `ALLOWED_ORIGINS` to include final production domain(s).
6. Keep old WordPress site available briefly as fallback.
7. Add redirects if old WP URLs differ.

---

## 11) Troubleshooting Quick Map

### A) `405` on login/save
- Usually routing/deploy mismatch.
- Check `GET /api/cms?action=health` returns JSON.
- If not JSON, functions are not active for that project/deploy.

### B) Site works on one URL but not another
- You are likely checking a different Pages project.
- Confirm deploy target and domain belong to the same project.

### C) Too many redirects (`ERR_TOO_MANY_REDIRECTS`)
- Usually function route handling or cached redirects.
- Verify latest deployed fix is in correct project.
- Hard refresh / clear site data.

### D) Admin logs in but cannot publish
- Check KV binding exists (`VILLA_COCO_CMS`) in that project environment.
- Check `ADMIN_PASSWORD` and `ALLOWED_ORIGINS`.

### E) SEO appears unchanged
- Verify with `view-source:`.
- If source unchanged, server-side function or KV read not active.

---

## 12) Operational Checklist Before Sharing With Owner

- [ ] Homepage loads on target URL
- [ ] `/admin` login works
- [ ] Save updates reflect on live site
- [ ] SEO source tags reflect admin values
- [ ] Analytics page shows real events
- [ ] Navigation order matches business intent
- [ ] Key sections readable on desktop and mobile
- [ ] Media links are direct/public and optimized

---

## 13) Recommended Next Improvements

- Add GA4 and Search Console for enterprise-grade SEO/traffic reporting
- Optionally wrap `/media/<key>` with Cloudflare image transformations for hero/cards/thumbnails (do not rewrite CMS URLs)
- Add role-based admin access and audit trail
- Add scheduled KV backups/export
- Later: orphan R2 cleanup for replaced objects still kept for CMS history

