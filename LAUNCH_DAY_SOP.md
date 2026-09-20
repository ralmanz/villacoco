# Villa Coco Launch Day SOP (One Pager)

Use this checklist during official go-live.

---

## 0) Pre-Launch (15-30 min before)

- Confirm latest code is deployed to Pages project: `villacoco`
- Confirm Cloudflare bindings/env:
  - `VILLA_COCO_CMS` (KV binding)
  - `VILLA_COCO_MEDIA` (R2 binding for admin image uploads)
  - `ADMIN_PASSWORD`
  - `OPENAI_API_KEY` (Coco concierge)
  - `OPENAI_MODEL` (optional; defaults to `gpt-5.6-luna`)
  - `ALLOWED_ORIGINS` includes final domain(s)
- Confirm admin login works at `/admin`
- Confirm SEO values are finalized in admin

---

## 1) DNS Cutover (GoDaddy -> Cloudflare Pages)

In Cloudflare Pages (`villacoco`) -> Custom domains:
- Add `villacocopanama.com`
- Add `www.villacocopanama.com`

In GoDaddy DNS, apply Cloudflare-provided records:
- root (`@`) target
- `www` CNAME target

Wait for propagation (usually minutes, can take longer).

---

## 2) Immediate Post-Cutover Checks

Open the final domain (root + www):
- Homepage loads
- `/admin` loads
- No redirect loop

API sanity:
- `/api/cms?action=health` returns JSON

---

## 3) SEO Verification (Critical)

Run:
- `view-source:https://YOUR_FINAL_DOMAIN/`

Verify in source:
- `<title>` is correct
- meta description is correct
- `og:title`, `og:description`, `og:image` are correct
- canonical uses final domain
- `og:url` uses final domain

Quick proof test:
- change title in admin to a temporary unique value
- save
- check `view-source` again
- restore final title

---

## 4) Analytics Verification

From 2 devices (desktop + phone):
- Visit homepage
- Click a few links/buttons

In admin -> Analytics -> Refresh:
- views increase
- unique visitors increase
- device split updates

---

## 5) Performance and UX Spot Check

- Hero, Wellness, Experiences, Food sections render correctly
- Mobile menu order is correct
- No unexpected section appears on mobile only
- Key images load quickly and are not broken

---

## 6) Search and Social Setup

- Verify property in Google Search Console (final domain)
- Request indexing for homepage
- Submit sitemap (if present)
- Test link preview in WhatsApp/Facebook/LinkedIn using final URL

---

## 7) Safety / Rollback Plan

If critical issue appears:
- Repoint DNS back to previous WordPress target (temporary rollback), or
- Keep old WP available on subdomain and route traffic there while fixing

Do not delete old WP immediately; keep it available for at least 1-2 weeks.

---

## 8) Owner Handoff Items

Share:
- production URL
- admin URL
- admin credentials (secure channel)
- `OWNER_MEDIA_GUIDE.md`
- `WEBSITE_INTELLIGENCE.md`
- this SOP

---

## 9) Final Sign-Off Checklist

- [ ] Domain points to Cloudflare Pages
- [ ] SSL valid on root + www
- [ ] Admin save/publish works
- [ ] SEO source tags match admin
- [ ] Analytics tracking works
- [ ] Mobile + desktop QA passed
- [ ] Owner received handoff docs

