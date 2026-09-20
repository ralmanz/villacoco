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

### Gallery uploads (Cloudflare Images)

The admin **Gallery** can upload JPG, PNG, or WebP via **Direct Creator Upload**. Add:

- **`CLOUDFLARE_ACCOUNT_ID`** — Cloudflare account ID (Overview in the dashboard sidebar).
- **`CLOUDFLARE_IMAGES_API_TOKEN`** — API token with **Account** → **Cloudflare Images** → **Edit** (and read if prompted).

Ensure your Images product has a **`public`** variant (default in many accounts). The first matching delivery URL is stored in CMS when upload completes.

If these variables are missing, `POST /api/cms?action=images-direct-upload` returns **503** with a clear error; pasting external image URLs still works.

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
