# Villa Coco — Deployment Guide

## Files in this package
- `index.html` — the live website
- `admin.html` — the content management panel
- `functions/api/cms.js` — the API that connects admin → KV storage
- `_redirects` — URL routing rules

---

## Deploy to Cloudflare Pages (one-time setup, ~20 minutes)

### Step 1 — Create a Cloudflare account
Go to cloudflare.com and create a free account.

### Step 2 — Create a KV Namespace
1. In the Cloudflare dashboard → **Workers & Pages** → **KV**
2. Click **Create a namespace**
3. Name it: `VILLA_COCO_CMS`
4. Save the namespace (you'll need its ID)

### Step 3 — Deploy to Cloudflare Pages
1. Go to **Workers & Pages** → **Create application** → **Pages**
2. Choose **Upload assets** (drag and drop)
3. Upload the entire folder (all files including `functions/`)
4. Set project name: `villacocopanama` (or similar)
5. Click **Deploy**

### Step 4 — Bind KV to your Pages project
1. Go to your Pages project → **Settings** → **Functions**
2. Under **KV namespace bindings**, click **Add binding**
3. Variable name: `VILLA_COCO_CMS`
4. Select the namespace you created in Step 2
5. Save and redeploy

### Step 5 — Set your admin password
1. Go to your Pages project → **Settings** → **Environment variables**
2. Click **Add variable**
3. Name: `ADMIN_PASSWORD`
4. Value: (choose a strong password — tell Olivia this password)
5. Save and redeploy

### Step 6 — Connect your domain
1. Go to your Pages project → **Custom domains**
2. Add `villacocopanama.com`
3. Cloudflare will guide you through the DNS setup
   - Ask the current host (Swiss guy) for the DNS access, or transfer the domain to Cloudflare

---

## How editing works (for Olivia & the front desk)

1. Go to `villacocopanama.com/admin`
2. Enter the admin password
3. Navigate to any section in the left sidebar
4. Edit any field — text, photos, hours, prices
5. Click **Save All Changes** — the live site updates within seconds
6. If something goes wrong, click **↩ Revert Last Save**

---

## Monthly maintenance checklist (for technical manager)
- Check Google Search Console for any crawl errors
- Update meta description if a new program launched
- Verify the site loads fast at PageSpeed Insights
- Renew domain before expiry (set a calendar reminder)

---

## Support
For technical issues, contact your technical manager.
For content questions, use the admin panel — almost everything is editable there.
