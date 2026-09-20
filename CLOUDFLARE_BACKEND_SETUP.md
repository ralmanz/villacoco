## Cloudflare Pages Backend Setup

This project uses a Cloudflare Pages Function at `functions/api/cms.js`.

### 1) Deploy with Functions enabled

- Use **Cloudflare Pages + Git integration** (recommended), or
- Deploy with Wrangler from this project root.

If you upload only static files, Functions will not run and `/api/cms` will return HTML instead of JSON.

### 2) Add required bindings in Cloudflare Pages

In your Pages project settings, add:

- **KV Namespace binding**
  - Variable name: `VILLA_COCO_CMS`
  - Value: your KV namespace
- **R2 bucket binding**
  - Variable name: `VILLA_COCO_MEDIA`
  - Value: the Villa Coco media bucket
- **Environment variable**
  - Variable name: `ADMIN_PASSWORD`
  - Value: your admin password

Optional:

- `ALLOWED_ORIGINS` (comma-separated origins)

### Coco concierge (OpenAI)

The public concierge at `/api/concierge` uses OpenAI server-side. Add:

- **`OPENAI_API_KEY`** — OpenAI API key (Pages secret). Never expose this in the browser.
- **`OPENAI_MODEL`** — optional model override (default `gpt-5.6-luna`). Use this to switch Coco to another model later without a code change.

If `OPENAI_API_KEY` is missing, guests see a generic unavailable message.

### Image uploads (Cloudflare R2)

Admin **Upload image** sends the file to an authenticated Pages Function, which stores one original in the `VILLA_COCO_MEDIA` R2 bucket and returns a canonical relative URL:

- `POST /api/cms?action=upload-media` (admin password required)
- Accepted types: JPEG, PNG, WebP
- Max size: 10 MB
- Stored key: `v1/YYYY/MM/<uuid>.<ext>` (never the raw filename)
- CMS value: `/media/<key>`

Public delivery:

- `GET` / `HEAD` `/media/<key>` via `functions/media/[[key]].js`
- Long-lived cache (`immutable`) because object keys are unique
- Unknown keys return 404
- The public route does not list the bucket or accept uploads

Do not store size-specific transformation URLs in CMS. Later, Cloudflare image transformations can wrap the same source, for example `/cdn-cgi/image/width=1600,quality=80/media/<key>`, without rewriting saved content. The bare `/media/<key>` path must keep working on `pages.dev` even if transformations are not enabled.

If `VILLA_COCO_MEDIA` is missing, uploads return **503** with a clear admin error. Existing HTTPS image URLs, including any previously saved Cloudflare Images URLs, continue to render as ordinary external URLs. Replaced R2 objects are not deleted automatically.

### 3) Verify the backend is live

After deploy, open:

- `/api/cms?action=health` -> should return JSON like `{ "ok": true, ... }`

Then:

- `/api/cms` -> should return `{}` (or saved data JSON)

### 4) Login behavior

Admin tries these endpoints automatically:

- `/api/cms`
- `/functions/api/cms`
- `/.netlify/functions/cms`

On Cloudflare, the correct one should be `/api/cms`.
