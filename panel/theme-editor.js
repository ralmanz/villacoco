/**
 * Villa Coco — admin theme editor
 * ---------------------------------------------------------------
 * Vanilla ES module. No framework, no build step.
 *
 *   import { mountThemeEditor, createThemeApi } from './theme-editor.js';
 *   const editor = mountThemeEditor(document.getElementById('page-themes'), {
 *     api: createThemeApi({ headers: () => ({ 'X-Admin-Password': getAdminPassword() }) }),
 *   });
 *
 * The editor owns its own load / draft autosave / publish cycle and never
 * touches the panel's global saveAll().
 *
 * API contract (see createThemeApi for a fetch implementation):
 *   load()            → { draft, published, history }
 *   saveDraft(state)  → void
 *   publish(state)    → { published, history }
 * `state` is always { base, overrides }.
 */
import * as E from '../theme-engine.js';

// ─── Fetch adapter ──────────────────────────────────────────────

/**
 * Default API adapter. INTEGRATION: match these URLs to the server routes.
 *   GET  /api/cms?action=theme          (auth) → { draft, published, history }
 *   POST /api/cms?action=theme-draft    (auth) body { state }
 *   POST /api/cms?action=theme-publish  (auth) body { state } → { published, history }
 */
export function createThemeApi({ base = '/api/cms', headers = () => ({}) } = {}) {
  const call = async (action, method, body) => {
    const res = await fetch(`${base}?action=${action}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(res.status === 401 ? 'Your session expired. Log in again to keep editing.' : `Server error ${res.status}${text ? ': ' + text.slice(0, 120) : ''}`);
    }
    return res.status === 204 ? null : res.json();
  };
  return {
    load: () => call('theme', 'GET'),
    saveDraft: (state) => call('theme-draft', 'POST', { state }),
    publish: (state) => call('theme-publish', 'POST', { state }),
  };
}

// ─── Small helpers ──────────────────────────────────────────────

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (root, sel) => root.querySelector(sel);
const $$ = (root, sel) => Array.from(root.querySelectorAll(sel));

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return ''; }
}

// ─── Styles (injected once) ─────────────────────────────────────

const STYLE_ID = 'vte-styles';
const CSS = `
.vte{--vte-ink:var(--ink,#1E1A16);--vte-bark:var(--bark,#29231F);--vte-gold:var(--gold,#B08D57);--vte-gold-text:#806236;--vte-line:#E4DED4;--vte-line-soft:#ECE7DF;--vte-muted:#6B645B;--vte-bg:#F7F5F1;--vte-ok-bg:#E4EEE4;--vte-ok:#2B5530;--vte-warn-bg:#F4EAD3;--vte-warn:#6E5010;--vte-bad-bg:#F5E1DD;--vte-bad:#8A2E22;--vte-serif:'Playfair Display',Georgia,serif;--vte-sans:'Lato','Helvetica Neue',Helvetica,sans-serif;
  font-family:var(--vte-sans);color:var(--vte-ink);display:flex;flex-direction:column;gap:28px}
.vte *{box-sizing:border-box}
.vte button{font:inherit}
.vte :focus-visible{outline:2px solid var(--vte-gold-text);outline-offset:2px}
.vte-head{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;padding-bottom:28px;border-bottom:1px solid var(--vte-line);flex-wrap:wrap}
.vte-title{margin:0;font-family:var(--vte-serif);font-weight:400;font-size:44px;line-height:1.1}
.vte-sub{margin:10px 0 0;font-size:16px;color:var(--vte-muted);max-width:60ch}
.vte-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.vte-status{font-size:12px;padding:8px 12px;font-weight:700;letter-spacing:1px}
.vte-status[data-state=live]{background:var(--vte-ok-bg);color:var(--vte-ok)}
.vte-status[data-state=draft]{background:var(--vte-warn-bg);color:var(--vte-warn)}
.vte-save{font-size:12px;color:var(--vte-muted);min-width:7em}
.vte-btn{min-height:44px;padding:0 18px;cursor:pointer;font-size:13px;letter-spacing:2px;text-transform:uppercase;border:1px solid #D6CFC3;background:#FFF;color:var(--vte-ink)}
.vte-btn:disabled{opacity:.45;cursor:default}
.vte-btn-primary{background:var(--vte-gold);border:2px solid var(--vte-bark);font-weight:700;padding:0 24px;min-height:48px}
.vte-btn-secondary{min-height:48px;padding:0 20px}
.vte-btn-ghost{font-size:12px;letter-spacing:1px;padding:0 16px}
.vte-link{background:none;border:none;color:var(--vte-gold-text);text-decoration:underline;cursor:pointer;font-size:14px;min-height:44px;padding:0 4px}
.vte-toast,.vte-error{padding:14px 18px;font-size:14px;display:flex;justify-content:space-between;align-items:center;gap:12px}
.vte-toast{background:var(--vte-ok-bg);color:var(--vte-ok)}
.vte-error{background:var(--vte-bad-bg);color:var(--vte-bad)}
.vte-toast .vte-link,.vte-error .vte-link{color:inherit}
.vte-work{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:28px;align-items:start}
.vte-col{display:flex;flex-direction:column;gap:24px;min-width:0}
.vte-card{background:#FFF;border:1px solid var(--vte-line);padding:28px;display:flex;flex-direction:column;gap:18px}
.vte-eyebrow{font-size:12px;letter-spacing:3px;color:var(--vte-gold-text);font-weight:700;text-transform:uppercase;margin:0}
.vte-hint{font-size:14px;color:var(--vte-muted);margin:6px 0 0}
.vte-group-name{font-size:13px;font-weight:700;color:#4A443D;margin:0 0 10px}
.vte-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.vte-theme{text-align:left;background:#FFF;border:1px solid var(--vte-line);margin:1px;padding:16px;display:flex;flex-direction:column;gap:10px;cursor:pointer;color:inherit}
.vte-theme:hover{border-color:#CFC6B8}
.vte-theme[aria-pressed=true]{border:2px solid var(--vte-gold);margin:0;box-shadow:0 0 0 3px #F1E8D6}
.vte-theme-top{display:flex;justify-content:space-between;align-items:center;gap:8px}
.vte-theme-name{font-family:var(--vte-serif);font-size:18px}
.vte-theme-desc{font-size:13px;color:var(--vte-muted);line-height:1.45}
.vte-tag{font-size:10px;letter-spacing:1px;padding:4px 8px;font-weight:700;white-space:nowrap}
.vte-tag[data-kind=custom]{background:var(--vte-warn-bg);color:var(--vte-warn)}
.vte-tag[data-kind=default]{background:#EFEBE4;color:#4A443D}
.vte-tag[data-kind=new]{background:var(--vte-ok-bg);color:var(--vte-ok)}
.vte-dots{display:flex;gap:6px}
.vte-dot{width:30px;height:30px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)}
.vte-tune-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.vte-tune-name{font-family:var(--vte-serif);font-size:22px;margin:6px 0 0}
.vte-role{border-top:1px solid var(--vte-line-soft);padding:16px 0 0;display:flex;flex-direction:column;gap:12px}
.vte-role-main{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.vte-chip{width:44px;height:44px;flex-shrink:0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.14)}
.vte-role-text{flex-grow:1;min-width:160px;display:flex;flex-direction:column;gap:3px}
.vte-role-label{font-weight:700;font-size:15px}
.vte-changed{font-weight:400;color:var(--vte-gold-text)}
.vte-role-help{font-size:13px;color:var(--vte-muted)}
.vte-badge{font-size:12px;padding:6px 10px;font-weight:700;white-space:nowrap}
.vte-badge[data-status=pass]{background:var(--vte-ok-bg);color:var(--vte-ok)}
.vte-badge[data-status=large]{background:var(--vte-warn-bg);color:var(--vte-warn)}
.vte-badge[data-status=fail]{background:var(--vte-bad-bg);color:var(--vte-bad)}
.vte-indent{margin-left:58px}
.vte-role-panel{display:flex;flex-direction:column;gap:14px}
.vte-swatches{display:flex;flex-wrap:wrap;gap:10px}
.vte-swatch{width:44px;height:44px;border:none;padding:0;cursor:pointer;background:var(--sw);box-shadow:inset 0 0 0 1px rgba(0,0,0,.14);position:relative}
.vte-swatch[aria-pressed=true]{box-shadow:0 0 0 2px #FFF,0 0 0 4px var(--vte-ink)}
.vte-swatch[data-original=true]::after{content:'';position:absolute;left:50%;bottom:-8px;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:var(--vte-muted)}
.vte-custom{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px;color:#4A443D}
.vte-custom input[type=color]{width:44px;height:44px;border:1px solid #D6CFC3;padding:2px;background:#FFF;cursor:pointer}
.vte-custom input[type=text]{width:112px;height:44px;border:1px solid #D6CFC3;padding:0 12px;font-family:ui-monospace,Menlo,monospace;font-size:14px;color:var(--vte-ink);background:#FFF}
.vte-custom input[aria-invalid=true]{border-color:var(--vte-bad)}
.vte-hexhint{color:var(--vte-bad);font-size:12px}
.vte-fail{background:#FBF1EE;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.vte-fail span{font-size:13px;color:var(--vte-bad);line-height:1.45}
.vte-fail button{background:var(--vte-bad);color:#FFF;border:none;padding:0 16px;min-height:44px;cursor:pointer;font-size:13px;letter-spacing:1px}
.vte-note{font-size:12px;color:var(--vte-muted);line-height:1.45;margin:0}
.vte-adv{border-top:1px solid var(--vte-line-soft);padding-top:16px;display:flex;align-items:center;gap:12px}
.vte-adv input{width:20px;height:20px;accent-color:var(--vte-gold-text);margin:0}
.vte-adv label{display:flex;flex-direction:column;gap:2px;cursor:pointer;font-size:14px}
.vte-adv small{font-size:13px;color:var(--vte-muted)}
.vte-history{list-style:none;margin:0;padding:0}
.vte-history li{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--vte-line-soft)}
.vte-hleft{display:flex;align-items:center;gap:12px;min-width:0}
.vte-mini{display:flex;flex-shrink:0}.vte-mini span{width:14px;height:28px}
.vte-hname{font-size:14px;font-weight:700;display:block}
.vte-hsub{font-size:12px;color:var(--vte-muted)}
.vte-empty{font-size:14px;color:var(--vte-muted);margin:0}
.vte-previewcard{position:sticky;top:24px;background:#FFF;border:1px solid var(--vte-line);padding:20px;display:flex;flex-direction:column;gap:16px;min-width:0}
.vte-preview-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.vte-seg{display:flex;border:1px solid #D6CFC3}
.vte-seg button{border:none;padding:0 16px;min-height:44px;cursor:pointer;font-size:13px;background:#FFF;color:#4A443D}
.vte-seg button[aria-pressed=true]{background:var(--vte-bark);color:#F3EEE6}
.vte-stage{background:#EFEBE4;padding:16px;display:flex;justify-content:center}
.vte-frame{width:100%;max-width:100%;box-shadow:0 1px 2px rgba(0,0,0,.08),0 8px 24px rgba(0,0,0,.08);overflow:hidden;transition:width .25s ease}
.vte-frame[data-device=phone]{width:375px}
.vte-chrome{background:#E2DDD5;padding:8px 12px;display:flex;align-items:center;gap:10px}
.vte-chrome i{width:9px;height:9px;border-radius:50%;background:#C9C2B7;display:inline-block}
.vte-url{flex-grow:1;background:#F4F1EC;font-size:11px;color:var(--vte-muted);padding:4px 10px}
@media (prefers-reduced-motion:reduce){.vte-frame{transition:none}}
@media (max-width:1180px){.vte-work{grid-template-columns:minmax(0,1fr)}.vte-previewcard{position:static}}
@media (max-width:560px){.vte-grid{grid-template-columns:minmax(0,1fr)}.vte-indent{margin-left:0}.vte-title{font-size:34px}.vte-card{padding:20px}}

/* Preview site: uses the SAME variable names as the live site */
.pv{background:var(--cream);color:var(--ink);font-family:var(--vte-sans)}
.pv-nav{padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--mist)}
.pv-logo{font-family:var(--vte-serif);font-size:16px;letter-spacing:2px}
.pv-links{display:flex;gap:16px;font-size:11px;letter-spacing:1px;color:var(--muted)}
.pv-btn{background:var(--gold);color:var(--on-accent);font-size:10px;letter-spacing:2px;padding:8px 12px;font-weight:700}
.pv-hero{background:var(--ocean);color:var(--on-deep);padding:56px 28px 48px;display:flex;flex-direction:column;gap:14px;position:relative}
.pv-photo{position:absolute;top:10px;right:12px;font-size:10px;letter-spacing:1px;opacity:.55}
.pv-kicker{font-size:10px;letter-spacing:3px;opacity:.85}
.pv-h1{font-family:var(--vte-serif);font-size:34px;line-height:1.15;margin:0;font-weight:400}
.pv-ctas{display:flex;gap:10px;flex-wrap:wrap;padding-top:6px}
.pv-ghost{border:1px solid var(--on-deep);font-size:10px;letter-spacing:2px;padding:9px 16px}
.pv-band{background:var(--bark);color:var(--on-band);padding:14px 20px;display:flex;justify-content:space-around;gap:12px;flex-wrap:wrap;font-size:11px;letter-spacing:1px;text-align:center}
.pv-story{padding:28px 20px 8px;display:flex;flex-direction:column;gap:10px}
.pv-label{font-size:10px;letter-spacing:3px;color:var(--accent-text);font-weight:700}
.pv-h2{font-family:var(--vte-serif);font-size:22px;line-height:1.2;margin:0;font-weight:400}
.pv-p{font-size:13px;line-height:1.6;color:var(--muted);margin:0}
.pv-rooms{padding:20px;display:flex;gap:14px;flex-wrap:wrap}
.pv-room{flex:1 1 200px;background:var(--sand);border:1px solid var(--mist);display:flex;flex-direction:column}
.pv-room-photo{height:96px;background:var(--foam);display:flex;align-items:center;justify-content:center;font-size:10px;letter-spacing:1px;color:var(--muted)}
.pv-room-body{padding:14px;display:flex;flex-direction:column;gap:6px}
.pv-room-name{font-family:var(--vte-serif);font-size:16px}
.pv-room-price{font-size:12px;color:var(--muted)}
.pv-room-cta{font-size:11px;letter-spacing:1px;color:var(--accent-text);font-weight:700;padding-top:4px}
.pv-foot{background:var(--bark);color:var(--on-band);padding:18px 20px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:11px}
.pv-foot span:last-child{opacity:.75}
.vte-frame[data-device=phone] .pv-links{display:none}
.vte-frame[data-device=phone] .pv-hero{padding:64px 20px 52px}
.vte-frame[data-device=phone] .pv-h1{font-size:28px}
`;

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

// ─── Markup ─────────────────────────────────────────────────────

function themeButton(t) {
  return `
    <button type="button" class="vte-theme" data-theme="${esc(t.id)}" aria-pressed="false">
      <span class="vte-theme-top">
        <span class="vte-theme-name">${esc(t.name)}</span>
        <span class="vte-tag" data-ref="tag" hidden></span>
      </span>
      <span class="vte-theme-desc">${esc(t.description)}</span>
      <span class="vte-dots" aria-hidden="true">
        ${E.ROLES.map((r) => `<span class="vte-dot" style="background:${esc(t.seeds[r])}"></span>`).join('')}
      </span>
    </button>`;
}

function roleRow(role) {
  const m = E.ROLE_META[role];
  return `
    <div class="vte-role" data-role="${role}">
      <div class="vte-role-main">
        <span class="vte-chip" data-ref="chip" aria-hidden="true"></span>
        <span class="vte-role-text">
          <span class="vte-role-label">${esc(m.label)}<span class="vte-changed" data-ref="changed" hidden> · changed</span></span>
          <span class="vte-role-help">${esc(m.help)}</span>
        </span>
        <span class="vte-badge" data-ref="badge"></span>
        <button type="button" class="vte-btn vte-btn-ghost" data-act="toggle" aria-expanded="false" aria-controls="vte-panel-${role}">Change</button>
      </div>
      <div class="vte-role-panel vte-indent" id="vte-panel-${role}" data-ref="panel" hidden>
        <div class="vte-swatches" role="group" aria-label="${esc(m.label)} color options" data-ref="options"></div>
        <div class="vte-custom" data-ref="custom" hidden>
          <label for="vte-hex-${role}">Custom color</label>
          <input type="color" data-act="picker" aria-label="${esc(m.label)} color picker">
          <input type="text" id="vte-hex-${role}" data-act="hex" spellcheck="false" autocomplete="off" maxlength="7" placeholder="#1E3A3F" aria-describedby="vte-hexhint-${role}">
          <span class="vte-hexhint" id="vte-hexhint-${role}" data-ref="hexhint" hidden>Use a 6-digit hex like #1E3A3F</span>
        </div>
      </div>
      <div class="vte-fail vte-indent" data-ref="fail" hidden>
        <span data-ref="failmsg"></span>
        <button type="button" data-act="fix">Fix it for me</button>
      </div>
      ${role === 'accent' ? '<p class="vte-note vte-indent" data-ref="note" hidden>Small labels on the site use a slightly deeper shade of this color so they stay readable.</p>' : ''}
    </div>`;
}

function skeleton() {
  return `
  <div class="vte">
    <div class="vte-head">
      <div>
        <h2 class="vte-title">Color Theme</h2>
        <p class="vte-sub">Pick a curated look, then fine-tune any color. The preview shows exactly what guests will see.</p>
      </div>
      <div class="vte-actions">
        <span class="vte-save" data-ref="save" aria-live="polite"></span>
        <span class="vte-status" data-ref="status"></span>
        <button type="button" class="vte-btn vte-btn-secondary" data-act="discard">Discard</button>
        <button type="button" class="vte-btn vte-btn-primary" data-act="publish">Publish to site</button>
      </div>
    </div>

    <div class="vte-toast" data-ref="toast" role="status" hidden>
      <span data-ref="toastmsg"></span>
      <button type="button" class="vte-link" data-act="dismiss">Dismiss</button>
    </div>
    <div class="vte-error" data-ref="error" role="alert" hidden>
      <span data-ref="errormsg"></span>
      <button type="button" class="vte-link" data-act="retry" data-ref="retry" hidden>Try again</button>
    </div>

    <div class="vte-work">
      <div class="vte-col">
        <section class="vte-card" aria-labelledby="vte-h-choose">
          <div>
            <h3 class="vte-eyebrow" id="vte-h-choose">1 · Choose a theme</h3>
            <p class="vte-hint">Every theme is pre-checked for readability.</p>
          </div>
          ${E.themesByGroup().map((g) => `
            <div>
              <p class="vte-group-name">${esc(g.label)}</p>
              <div class="vte-grid">${g.themes.map(themeButton).join('')}</div>
            </div>`).join('')}
        </section>

        <section class="vte-card" aria-labelledby="vte-h-tune">
          <div class="vte-tune-head">
            <div>
              <h3 class="vte-eyebrow" id="vte-h-tune">2 · Fine-tune</h3>
              <p class="vte-tune-name" data-ref="tunename"></p>
              <p class="vte-hint">Swap any color. Every option is matched to the rest of the theme.</p>
            </div>
            <button type="button" class="vte-link" data-act="reset" data-ref="reset" hidden>Reset to original</button>
          </div>
          ${E.ROLES.map(roleRow).join('')}
          <div class="vte-adv">
            <input type="checkbox" id="vte-adv" data-act="advanced">
            <label for="vte-adv"><strong>Advanced: custom colors</strong><small>Use an exact hex, e.g. from a logo or brand guide.</small></label>
          </div>
        </section>

        <section class="vte-card" aria-labelledby="vte-h-hist">
          <h3 class="vte-eyebrow" id="vte-h-hist">Version history</h3>
          <ul class="vte-history" data-ref="history"></ul>
        </section>
      </div>

      <div class="vte-previewcard">
        <div class="vte-preview-head">
          <div>
            <p class="vte-eyebrow">Live preview</p>
            <p class="vte-hint" data-ref="previewsub"></p>
          </div>
          <div class="vte-seg" role="group" aria-label="Preview size">
            <button type="button" data-act="device" data-device="desktop" aria-pressed="true">Desktop</button>
            <button type="button" data-act="device" data-device="phone" aria-pressed="false">Phone</button>
          </div>
        </div>
        <div class="vte-stage">
          <div class="vte-frame" data-ref="frame" data-device="desktop">
            <div class="vte-chrome" aria-hidden="true"><span><i></i> <i></i> <i></i></span><span class="vte-url">villacocopanama.com</span></div>
            <div class="pv" data-ref="site" aria-label="Website preview">
              <div class="pv-nav"><span class="pv-logo">VILLA COCO</span><span class="pv-links"><span>ROOMS</span><span>WELLNESS</span><span>RESTAURANT</span><span>EXPERIENCES</span></span><span class="pv-btn">BOOK NOW</span></div>
              <div class="pv-hero"><span class="pv-photo">HERO PHOTO</span><span class="pv-kicker">SANTA CATALINA · PANAMÁ</span><p class="pv-h1">A boutique retreat by the Pacific</p><span class="pv-ctas"><span class="pv-btn">CHECK AVAILABILITY</span><span class="pv-ghost">OUR ROOMS</span></span></div>
              <div class="pv-band"><span>BEACHFRONT</span><span>NEAR COIBA NATIONAL PARK</span><span>SURF &amp; DIVE</span></div>
              <div class="pv-story"><span class="pv-label">OUR STORY</span><p class="pv-h2">Slow mornings, warm water, good company</p><p class="pv-p">Secondary text like descriptions and room details uses this tone.</p></div>
              <div class="pv-rooms">
                <div class="pv-room"><div class="pv-room-photo">ROOM PHOTO</div><div class="pv-room-body"><span class="pv-room-name">Room name</span><span class="pv-room-price">From $ / night</span><span class="pv-room-cta">VIEW ROOM</span></div></div>
                <div class="pv-room"><div class="pv-room-photo">ROOM PHOTO</div><div class="pv-room-body"><span class="pv-room-name">Room name</span><span class="pv-room-price">From $ / night</span><span class="pv-room-cta">VIEW ROOM</span></div></div>
              </div>
              <div class="pv-foot"><span class="pv-logo">VILLA COCO</span><span>Santa Catalina, Veraguas · Panamá</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// ─── Mount ──────────────────────────────────────────────────────

export function mountThemeEditor(container, { api, draftDelay = 700, onChange } = {}) {
  if (!api) throw new Error('mountThemeEditor: `api` is required');
  injectStyles();
  container.innerHTML = skeleton();
  const root = container.firstElementChild;
  const ref = (name, scope = root) => $(scope, `[data-ref="${name}"]`);

  const st = {
    ready: false,
    draft: E.defaultState(),
    published: E.defaultState(),
    history: [],
    openRole: null,
    advanced: false,
    device: 'desktop',
    save: 'idle',          // idle | pending | saving | saved | error
    publishing: false,
    toast: '',
    error: '',
    errorRetry: null,
  };

  let draftTimer = null;
  let lastOptionsKey = '';
  let lastHistory = null;

  // ── Rendering (patches stable DOM; never rebuilds inputs) ─────
  function update() {
    const draft = E.normalizeState(st.draft);
    const dirty = !E.isSameState(draft, st.published);
    const theme = E.getTheme(draft.base);
    const seeds = E.resolveSeeds(draft);
    const derived = E.deriveTokens(draft);
    const checks = E.checkTheme(draft);
    const customized = E.isCustomized(draft);
    const busy = !st.ready || st.publishing;

    // Header
    const status = ref('status');
    status.dataset.state = dirty ? 'draft' : 'live';
    status.textContent = dirty ? 'Unpublished changes' : 'Live on site';
    ref('save').textContent = { idle: '', pending: '', saving: 'Saving draft…', saved: 'Draft saved', error: 'Draft not saved' }[st.save];
    $(root, '[data-act="discard"]').disabled = busy || !dirty;
    const pub = $(root, '[data-act="publish"]');
    pub.disabled = busy || !dirty;
    pub.textContent = st.publishing ? 'Publishing…' : 'Publish to site';

    // Toast / error
    ref('toast').hidden = !st.toast;
    ref('toastmsg').textContent = st.toast;
    ref('error').hidden = !st.error;
    ref('errormsg').textContent = st.error;
    ref('retry').hidden = !st.errorRetry;

    // Theme cards
    for (const btn of $$(root, '[data-theme]')) {
      const id = btn.dataset.theme;
      const t = E.getTheme(id);
      const selected = id === draft.base;
      btn.setAttribute('aria-pressed', String(selected));
      btn.disabled = !st.ready;
      const tag = ref('tag', btn);
      let kind = '', text = '';
      if (selected && customized) { kind = 'custom'; text = 'CUSTOMIZED'; }
      else if (t.approved) { kind = 'default'; text = 'DEFAULT'; }
      else if (t.isNew) { kind = 'new'; text = 'NEW'; }
      tag.hidden = !kind; tag.dataset.kind = kind; tag.textContent = text;
    }

    // Fine-tune
    ref('tunename').textContent = E.stateLabel(draft);
    ref('reset').hidden = !customized;
    $(root, '[data-act="advanced"]').checked = st.advanced;

    const optionsKey = draft.base;
    const rebuildOptions = optionsKey !== lastOptionsKey;
    lastOptionsKey = optionsKey;

    for (const role of E.ROLES) {
      const row = $(root, `[data-role="${role}"]`);
      const c = checks[role];
      ref('chip', row).style.background = seeds[role];
      ref('changed', row).hidden = !draft.overrides[role];
      const badge = ref('badge', row);
      badge.dataset.status = c.status.id;
      badge.textContent = `${c.status.label} ${c.ratioText}`;
      badge.title = `Weakest pair: ${c.worst}`;

      const open = st.openRole === role;
      const toggle = $(row, '[data-act="toggle"]');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Done' : 'Change';
      toggle.disabled = !st.ready;
      ref('panel', row).hidden = !open;

      const optionsEl = ref('options', row);
      const opts = E.swatchOptions(draft, role);
      if (rebuildOptions || optionsEl.childElementCount !== opts.length) {
        optionsEl.innerHTML = opts.map((o) => `
          <button type="button" class="vte-swatch" data-act="swatch" data-hex="${o.hex}" data-original="${o.isOriginal}"
            style="--sw:${o.hex}" aria-pressed="false"
            aria-label="${esc(E.ROLE_META[role].label)} ${o.isOriginal ? 'theme original ' : 'option '}${o.hex}"></button>`).join('');
      }
      for (const b of $$(optionsEl, '[data-act="swatch"]')) b.setAttribute('aria-pressed', String(b.dataset.hex === seeds[role]));

      ref('custom', row).hidden = !st.advanced;
      const picker = $(row, '[data-act="picker"]');
      const hex = $(row, '[data-act="hex"]');
      if (document.activeElement !== picker) picker.value = seeds[role].toLowerCase();
      if (document.activeElement !== hex) { hex.value = seeds[role]; hex.removeAttribute('aria-invalid'); ref('hexhint', row).hidden = true; }

      ref('fail', row).hidden = c.status.ok;
      ref('failmsg', row).textContent = c.message;
      const note = ref('note', row);
      if (note) note.hidden = !(c.status.ok && derived.tokens['accent-text'] !== derived.tokens.gold);
    }

    // History
    if (lastHistory !== st.history) {
      lastHistory = st.history;
      const list = ref('history');
      if (!st.history.length) {
        list.innerHTML = '<li><p class="vte-empty">Published versions will appear here.</p></li>';
      } else {
        list.innerHTML = st.history.map((h, i) => {
          const s = E.resolveSeeds(h);
          const live = i === 0 && E.isSameState(h, st.published);
          return `<li>
            <span class="vte-hleft">
              <span class="vte-mini" aria-hidden="true">${E.ROLES.map((r) => `<span style="background:${s[r]}"></span>`).join('')}</span>
              <span><span class="vte-hname">${esc(h.name || E.stateLabel(h))}</span>
              <span class="vte-hsub">${esc(formatDate(h.publishedAt))}${live ? ' · live now' : ''}</span></span>
            </span>
            <button type="button" class="vte-btn vte-btn-ghost" data-act="load" data-index="${i}">Load</button>
          </li>`;
        }).join('');
      }
    }
    for (const b of $$(root, '[data-act="load"]')) b.disabled = busy;

    // Preview
    E.applyTokens(ref('site'), derived.tokens);
    ref('frame').dataset.device = st.device;
    for (const b of $$(root, '[data-act="device"]')) b.setAttribute('aria-pressed', String(b.dataset.device === st.device));
    ref('previewsub').textContent = dirty
      ? 'Showing your draft. Guests still see the published version.'
      : 'Matches what guests see right now.';

    if (onChange) onChange({ draft, published: st.published, dirty });
  }

  // ── Persistence ───────────────────────────────────────────────
  function scheduleDraftSave() {
    clearTimeout(draftTimer);
    st.save = 'pending';
    draftTimer = setTimeout(saveDraftNow, draftDelay);
  }

  async function saveDraftNow() {
    clearTimeout(draftTimer);
    draftTimer = null;
    const snapshot = E.normalizeState(st.draft);
    st.save = 'saving'; update();
    try {
      await api.saveDraft(snapshot);
      if (E.isSameState(snapshot, st.draft)) st.save = 'saved';
      if (st.error && st.errorRetry === saveDraftNow) { st.error = ''; st.errorRetry = null; }
    } catch (e) {
      st.save = 'error';
      st.error = `Your draft couldn't be saved. ${e.message}`;
      st.errorRetry = saveDraftNow;
    }
    update();
  }

  function commit(nextDraft) {
    st.draft = E.normalizeState(nextDraft);
    st.toast = '';
    scheduleDraftSave();
    update();
  }

  async function publish() {
    if (st.publishing) return;
    const state = E.normalizeState(st.draft);
    st.publishing = true; st.error = ''; st.errorRetry = null; update();
    try {
      clearTimeout(draftTimer); draftTimer = null;
      const res = await api.publish(state);
      st.published = E.normalizeState(res?.published ?? state);
      st.history = Array.isArray(res?.history) ? res.history : E.pushHistory(st.history, state);
      st.draft = E.normalizeState(st.published);
      st.save = 'idle';
      st.openRole = null;
      st.toast = `Published. ${E.stateLabel(st.published)} will be live within about a minute.`;
    } catch (e) {
      st.error = `Couldn't publish. ${e.message}`;
      st.errorRetry = publish;
    } finally {
      st.publishing = false;
      update();
    }
  }

  async function load() {
    st.error = ''; st.errorRetry = null; update();
    try {
      const data = (await api.load()) || {};
      st.published = E.normalizeState(data.published);
      st.draft = E.normalizeState(data.draft ?? data.published);
      st.history = Array.isArray(data.history) ? data.history : [];
      st.ready = true;
    } catch (e) {
      st.error = `Couldn't load the theme. ${e.message}`;
      st.errorRetry = load;
    }
    lastHistory = null;
    update();
  }

  // ── Events ────────────────────────────────────────────────────
  root.addEventListener('click', (ev) => {
    const themeBtn = ev.target.closest('[data-theme]');
    if (themeBtn && st.ready) {
      if (themeBtn.dataset.theme === E.normalizeState(st.draft).base) return;
      st.openRole = null;
      commit(E.selectTheme(themeBtn.dataset.theme));
      return;
    }
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const row = el.closest('[data-role]');
    const role = row?.dataset.role;

    switch (el.dataset.act) {
      case 'toggle':
        st.openRole = st.openRole === role ? null : role; update(); break;
      case 'swatch':
        commit(E.setOverride(st.draft, role, el.dataset.hex)); break;
      case 'fix':
        commit(E.fixRole(st.draft, role)); break;
      case 'reset':
        commit(E.clearOverrides(st.draft)); break;
      case 'discard':
        st.openRole = null; commit(st.published); break;
      case 'publish':
        publish(); break;
      case 'load': {
        const h = st.history[Number(el.dataset.index)];
        if (h) { st.openRole = null; commit({ base: h.base, overrides: h.overrides }); }
        break;
      }
      case 'device':
        st.device = el.dataset.device; update(); break;
      case 'dismiss':
        st.toast = ''; update(); break;
      case 'retry':
        if (st.errorRetry) st.errorRetry(); break;
    }
  });

  root.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset.act === 'advanced') { st.advanced = el.checked; update(); }
  });

  root.addEventListener('input', (ev) => {
    const el = ev.target;
    const row = el.closest('[data-role]');
    if (!row) return;
    const role = row.dataset.role;
    if (el.dataset.act === 'picker') {
      commit(E.setOverride(st.draft, role, el.value));
    } else if (el.dataset.act === 'hex') {
      let v = el.value.trim();
      if (v && v[0] !== '#') v = '#' + v;
      const valid = E.isValidHex(v);
      const showHint = !valid && v.length >= 7;
      el.setAttribute('aria-invalid', String(showHint));
      ref('hexhint', row).hidden = !showHint;
      if (valid) commit(E.setOverride(st.draft, role, v));
    }
  });

  root.addEventListener('focusout', (ev) => {
    // When leaving a hex field, snap it back to the applied color.
    if (ev.target.dataset?.act === 'hex') setTimeout(update, 0);
  });

  const beforeUnload = (e) => {
    if (draftTimer || st.save === 'saving' || st.publishing) { e.preventDefault(); e.returnValue = ''; }
  };
  window.addEventListener('beforeunload', beforeUnload);

  update();
  load();

  return {
    reload: load,
    flush: () => (draftTimer ? saveDraftNow() : Promise.resolve()),
    getState: () => ({ draft: E.normalizeState(st.draft), published: st.published, history: st.history }),
    destroy: () => {
      clearTimeout(draftTimer);
      window.removeEventListener('beforeunload', beforeUnload);
      container.innerHTML = '';
    },
  };
}
