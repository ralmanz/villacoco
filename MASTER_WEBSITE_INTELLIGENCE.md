# Villa Coco Master Website Intelligence

Single source of truth for anyone touching this website: owner, operations, marketing, and developers.

---

## 1) Purpose and Scope

This document centralizes:
- how the site is built
- where content lives
- how to deploy safely
- how SEO and analytics work
- what to verify before sharing or launching
- how to troubleshoot common failures

Use this as the canonical handoff/reference doc.

---

## 2) Current Production Identity

- **Primary Pages project:** `villacoco`
- **Current site URL:** `https://villacoco.pages.dev`
- **Admin URL:** `https://villacoco.pages.dev/admin`
- **Stack:** static frontend + Cloudflare Pages Functions + Cloudflare KV

Avoid using multiple Pages projects for the same site unless intentional.

---

## 3) Who Uses This and For What

- **Owner / Content Manager**
  - edits text/images/SEO in admin panel
  - reviews Analytics page
- **Operator / PM**
  - validates deploys, checks QA, coordinates launch
- **Developer**
  - updates code, runs deploy command, maintains functions/KV integrations

---

## 4) Repository Map

- `index.html` -> public website
- `admin/index.html` -> content admin panel
- `functions/api/cms.js` -> CMS API + analytics API
- `functions/[[path]].js` -> server-side homepage SEO injection
- `_redirects` -> admin routing behavior
- `_routes.json` -> Pages Functions route scope
- `OWNER_MEDIA_GUIDE.md` -> image standards for owner
- `LAUNCH_DAY_SOP.md` -> launch sequence
- `WEBSITE_INTELLIGENCE.md` -> extended technical doc

---

## 5) Core Content Architecture

All editable website content is stored in KV key:
- `cms_current`

Admin writes to that key via API.
Public site reads from API and applies content client-side.

---

## 6) Navigation and Section Logic (Current)

Menu order:
1. Sleep
2. Wellness
3. Eat & Drink
4. Experiences
5. Packages
6. Testimonials
7. Contact

Important behavior:
- Infinity Pool is **not** a standalone section.
- Infinity Pool is injected as the **first active experience item**.

---

## 7) Cloudflare Configuration (Required)

In Pages project `villacoco`:

### Variables
- `ADMIN_PASSWORD`
- `OPENAI_API_KEY` (Coco concierge; server-side only)
- `OPENAI_MODEL` (optional; default `gpt-5.6-luna`)
- `ALLOWED_ORIGINS` (recommended), e.g.:
  - `https://villacoco.pages.dev`
  - add final domain(s) at launch

### Bindings
- KV binding:
  - variable: `VILLA_COCO_CMS`
  - value: the Villa Coco KV namespace
- R2 binding:
  - variable: `VILLA_COCO_MEDIA`
  - value: the Villa Coco media bucket

---

## 8) Deployment (Authoritative Command)

Always deploy to the same project:

```bash
cd "/Users/ronelalmanza/Desktop/villacoco/project"
npx wrangler@latest pages deploy . --project-name villacoco --branch production --commit-dirty=true
```

If changes do not appear, first verify deploy target project name.

---

## 9) SEO System (How It Really Works)

### Working behavior
- Owner edits SEO in admin and saves.
- Values persist in KV under `cms_current.seo`.
- `functions/[[path]].js` injects SEO tags server-side into homepage HTML.

### Why this matters
Bots/scrapers (Google, social previews) read HTML source; server-side injection is required for reliable indexing/snippets.

### Verification command
```bash
curl -s "https://villacoco.pages.dev/" | grep -n "meta-title\|og:title\|twitter:title\|canonical"
```

If updated values are missing in source:
- confirm latest deploy on `villacoco`
- confirm `_routes.json` and `functions/[[path]].js` are deployed
- confirm `cms_current.seo` has new values (`/api/cms`)

---

## 10) Analytics System (Current)

Tracked:
- page views
- link clicks
- unique visitors (browser-level ID estimate)
- device split (desktop/mobile/tablet/other)
- daily trend (Views / Users / Clicks)

Storage key:
- `cms_analytics`

Admin Analytics page displays:
- total views
- unique visitors
- clicks
- clicks per view
- mobile share
- top pages, top clicks, device table, 14-day trend

Note: lightweight first-party analytics, not GA4-equivalent attribution.

---

## 11) Media Policy (Owner Content)

Accepted URLs:
- new admin uploads: canonical `/media/<key>` from the `VILLA_COCO_MEDIA` R2 bucket
- existing public `https://...` file URLs (including previously saved remote or Cloudflare Images URLs)

Avoid:
- Dropbox/Drive preview links
- private/authenticated URLs
- storing size-specific transformation URLs in CMS

Recommended hosting:
- Admin **Upload image** → R2 original → `/media/<key>`
- Optional later delivery wrappers such as `/cdn-cgi/image/width=1600,quality=80/media/<key>` without rewriting CMS content

Reference standards:
- see `OWNER_MEDIA_GUIDE.md`

---

## 12) Launch and Domain Cutover

Domain registered at GoDaddy can stay there; only DNS needs to point to Cloudflare Pages.

At launch:
1. Add custom domain(s) in Cloudflare Pages (`villacoco`)
2. Update GoDaddy DNS records as instructed by Cloudflare
3. Ensure `ALLOWED_ORIGINS` includes final domain(s)
4. Re-verify SEO source, admin save, analytics

Use `LAUNCH_DAY_SOP.md` as step-by-step script.

---

## 13) Final Pre-Share QA (Owner Review)

1. Site and admin load (`/` and `/admin`)
2. Save changes from admin updates live content
3. SEO source tags reflect admin values
4. Analytics counters update after real interactions
5. Mobile + desktop section order/readability pass

---

## 14) Troubleshooting Quick Index

### A) 405 / API errors
- usually function route/deploy mismatch
- check `GET /api/cms?action=health`

### B) Deploy success but no visible change
- wrong Pages project target
- cached browser state
- stale deploy domain checked

### C) SEO value in admin but not in source
- server-side SEO function not deployed/executing
- check source via curl/grep and project bindings

### D) Redirect loop
- typically function routing conflict
- verify latest function fix is deployed on correct project

---

## 15) Operational Security and Ownership

- Share admin password via secure channel only
- Rotate password after handoff milestones
- Restrict who has Cloudflare deploy access
- Keep one named project as canonical (`villacoco`)

---

## 16) Recommended Next Improvements

- Add GA4 + Search Console integration
- Optionally wrap `/media/<key>` with Cloudflare image transformations (keep one R2 original)
- Add admin audit trail/version history for content edits
- Add automated backup/export of KV content
- Later: orphan R2 cleanup for replaced objects kept for CMS history

---

## 17) Document Control

- **Canonical doc:** `MASTER_WEBSITE_INTELLIGENCE.md`
- Supporting docs:
  - `LAUNCH_DAY_SOP.md`
  - `OWNER_MEDIA_GUIDE.md`
  - `WEBSITE_INTELLIGENCE.md`

When updates happen, update this file first.

