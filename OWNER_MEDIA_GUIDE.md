# Villa Coco Media Guide (Owner Handoff)

This guide explains what image/video links the website accepts and how to prepare media so the site looks premium and loads fast.

## What links are accepted in admin

The fastest path is **Upload image** in admin (JPG, PNG, or WebP, 10 MB or smaller). Preview appears immediately. Click **Save All Changes** to publish.

You can still paste a **public direct URL** over `https://` (or `http://`) if the photo already lives elsewhere.

- Good: upload in admin, or `https://cdn.example.com/images/hero-sunrise.jpg`
- Risky: Dropbox/Google Drive preview/share pages
- Not allowed: private/auth-required URLs

If a pasted link does not show in preview, it is usually not a direct file URL. Existing saved links keep working; they are not rewritten automatically.

## Recommended media hosting

Best option: **Upload image** in the Villa Coco admin.

Why:
- The file is stored with the website (one original)
- The owner never needs a separate image host
- Links stay stable (`/media/...` on this site)
- Later image resizing can use that same original without re-uploading

Pasting an existing public URL remains a fallback.

## Image format and quality standards

- Preferred format: `JPG` for photos, `WEBP` if available
- Avoid PNG for large photos (usually heavier)
- Color space: `sRGB`
- Keep sharp but compressed (target quality ~75-85)
- No watermarks or text baked into images

## Recommended dimensions by section

These are practical targets for quality + performance.

- **Hero background**
  - Target: `1920 x 1080`
  - Minimum: `1600 x 900`
  - Ratio: `16:9`

- **Story image**
  - Target: `1200 x 1500`
  - Ratio: `4:5` (portrait)

- **Rooms images**
  - Target: `1400 x 1000`
  - Ratio: `7:5` (landscape)
  - Keep all room photos same ratio for a clean grid

- **Wellness images (2 images)**
  - Target: `1200 x 900`
  - Ratio: `4:3`

- **Experiences images**
  - Target: `1600 x 1000`
  - Ratio: `8:5`
  - Works well for desktop panel and mobile accordion

- **Food section image**
  - Target: `1600 x 1200`
  - Ratio: `4:3`

- **Gallery strip images**
  - Target: `1200 x 900`
  - Ratio: `4:3`
  - Keep all 5 gallery images same ratio

- **Pool image (if reused independently)**
  - Target: `1600 x 900`
  - Ratio: `16:9`

- **SEO / Social share image (OG image)**
  - Target: `1200 x 630`
  - Exact ratio recommended for WhatsApp/Facebook

## File size targets

- Hero/large section images: aim for **250-500 KB**
- Standard section images: aim for **150-350 KB**
- Gallery images: aim for **120-250 KB**
- OG image: ideally **<300 KB**

If a page feels slow, media size is usually the first thing to reduce.

## Naming convention (recommended)

Use clean, stable file names so links are easy to manage:

- `villacoco-hero-2026-01.jpg`
- `villacoco-room-deluxe-villa-01.jpg`
- `villacoco-experience-coiba-01.jpg`
- `villacoco-og-1200x630.jpg`

Avoid spaces and random upload names like `IMG_9384.JPG`.

## Quick owner workflow

1. In admin, click **Upload image** for that section (Hero, Story, rooms, gallery, etc.).
2. Confirm the preview appears.
3. Click **Save Changes** in that section (or **Save All Changes**).
4. Refresh homepage and mobile view to verify.
5. Optional fallback: paste a public image URL instead of uploading.

## QA checklist before publishing new media

- Image looks sharp on desktop and mobile
- Subject is not awkwardly cropped
- Text overlays remain readable
- File loads quickly
- URL is public and permanent
- No duplicate old images remaining in section

