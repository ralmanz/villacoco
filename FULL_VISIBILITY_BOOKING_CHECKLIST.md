# Villa Coco Full Visibility/Booking Checklist

Use this as the execution checklist to move from "good website" to a full direct-booking growth engine.

## Phase 1: SEO Crawlability and Indexing Foundation

- [x] Server-rendered SEO tags (title, description, OG, Twitter, canonical)
- [x] Schema.org hotel structured data on homepage
- [x] SEO fields editable in admin panel
- [x] SEO health checks visible in marketing dashboard
- [ ] Add `sitemap.xml` to production root
- [ ] Add `robots.txt` to production root
- [ ] Verify `sitemap.xml` is accessible publicly (200)
- [ ] Verify `robots.txt` is accessible publicly (200)
- [ ] Submit sitemap in Google Search Console
- [ ] Add Google site verification tag (or DNS verification)

## Phase 2: Search Console Integration (Real Data)

- [ ] Implement Google OAuth connect flow in admin (`Connect Search Console`)
- [ ] Securely store refresh token server-side (KV)
- [ ] Add backend endpoint to fetch GSC metrics
- [ ] Show last-28-day KPIs (clicks, impressions, CTR, avg position)
- [ ] Show top queries and top pages from GSC
- [ ] Surface GSC errors/warnings in marketing panel

## Phase 3: Booking Conversion Instrumentation

- [x] First-party analytics tracking (views, clicks, unique visitors, device split)
- [ ] Track key booking intent events:
  - [ ] `book_now_click`
  - [ ] `whatsapp_click`
  - [ ] `email_click`
  - [ ] `menu_click`
- [ ] Create conversion rate widgets in Marketing Overview
- [ ] Add "Top converting pages/sections" report
- [ ] Add campaign parameter capture (`utm_source`, `utm_medium`, `utm_campaign`)

## Phase 4: Direct Booking Growth Operations

- [x] Inquiry Toolkit templates in admin
- [ ] Add weekly publishing planner (3-post cadence)
- [ ] Add monthly SEO task queue in admin (operational reminders)
- [ ] Add monthly performance snapshot export (PDF or markdown)
- [ ] Add OTA-vs-direct booking narrative panel (ROI storytelling for owner)

## Phase 5: Trust and Local Discovery

- [ ] Complete and optimize Google Business Profile:
  - [ ] Service categories
  - [ ] Description with target keywords
  - [ ] Fresh photos
  - [ ] Booking/contact links
  - [ ] Q&A and review response process
- [ ] Add consistent NAP (name, address, phone) across website and profiles
- [ ] Add review collection workflow (post-stay message templates)

## Phase 6: Performance and Technical Hygiene

- [x] Cloudflare Pages deployment flow in place
- [x] Cloudflare KV CMS backend in place
- [ ] Add image compression workflow/check
- [ ] Add broken-link QA script/process
- [ ] Add uptime/error monitoring alert
- [ ] Add quarterly content freshness review

## "Done" Definition for Full Impact

You can consider this complete when:

- Search Console is connected and producing real query/page data.
- Sitemap and robots are live and validated.
- Conversion events are tracked and visible in dashboard.
- Monthly operations (SEO + content + profile hygiene) run consistently.
- Direct-booking contribution is measurable and improving over time.

