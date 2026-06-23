/**
 * Villa Coco — Concierge chat widget (vanilla, no build, no deps)
 * Serve as a static asset at the repo root, then add before </body> in index.html:
 *   <script src="/concierge-widget.js" defer></script>
 *
 * Talks to POST /api/concierge. Uses Shadow DOM so the site's global CSS
 * (border-radius:0, custom cursor, etc.) can't leak in or out.
 * Launcher stacks above Instagram / WhatsApp (.floats) on the bottom-right.
 */
(function () {
  if (window.__villaCocoConcierge) return;
  window.__villaCocoConcierge = true;

  var ENDPOINT = "/api/concierge";
  var SESSION_KEY = "villacoco_concierge_session";
  var WELCOME =
    "Hi, I'm Coco — your concierge here at Villa Coco. I can help with check-in, amenities, things to do nearby, or planning your stay. How can I help?";
  var SUGGESTIONS = ["What time is check-in?", "What's there to do nearby?", "Is there WiFi and parking?"];

  // ----- state -----
  var messages = []; // real turns sent to the API (excludes the welcome)
  var loading = false;
  var open = false;

  function getSessionId() {
    try {
      var id = localStorage.getItem(SESSION_KEY);
      if (!id) {
        id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(16).slice(2);
        localStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (e) {
      return String(Date.now());
    }
  }
  function getVisitorId() {
    try {
      return localStorage.getItem("villacoco_visitor_v1") || null;
    } catch (e) {
      return null;
    }
  }

  // ----- shadow root + styles -----
  var host = document.createElement("div");
  host.setAttribute("aria-live", "polite");
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent = [
    ":host{all:initial}",
    "*{box-sizing:border-box;font-family:'Lato',sans-serif}",
    ".launcher{position:fixed;right:28px;bottom:148px;width:50px;height:50px;border-radius:50%;",
    "background:#b8965a;color:#1c1c1a;border:2px solid rgba(255,255,255,.92);cursor:pointer;z-index:9000;",
    "box-shadow:0 4px 18px rgba(0,0,0,.28),0 2px 8px rgba(184,150,90,.45);display:flex;align-items:center;justify-content:center;transition:transform .18s ease,box-shadow .18s ease,background .18s ease}",
    ".launcher:hover{transform:scale(1.1);background:#c9a56a;box-shadow:0 6px 24px rgba(0,0,0,.32),0 2px 10px rgba(184,150,90,.55)}",
    ".launcher svg{width:22px;height:22px;stroke-width:2}",
    ".panel{position:fixed;right:28px;bottom:28px;width:380px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 48px);",
    "background:#faf8f3;z-index:9001;display:none;flex-direction:column;overflow:hidden;",
    "box-shadow:0 18px 50px rgba(28,28,26,.30);border:1px solid #e8e2d8}",
    ".panel.open{display:flex}",
    ".header{background:#1e3a3f;color:#faf8f3;padding:16px 18px;display:flex;align-items:center;gap:12px;flex-shrink:0}",
    ".badge{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center}",
    ".badge svg{width:20px;height:20px}",
    ".title{font-family:'Playfair Display',Georgia,serif;font-size:18px;line-height:1.1;letter-spacing:.02em}",
    ".sub{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:rgba(250,248,243,.7);display:flex;align-items:center;gap:6px;margin-top:3px}",
    ".dot{width:7px;height:7px;border-radius:50%;background:#7fb89a;display:inline-block}",
    ".close{margin-left:auto;background:none;border:none;color:rgba(250,248,243,.8);cursor:pointer;font-size:20px;line-height:1;padding:4px}",
    ".msgs{flex:1;overflow-y:auto;padding:18px 16px;display:flex;flex-direction:column;gap:10px}",
    ".row{display:flex}",
    ".row.user{justify-content:flex-end}",
    ".row.bot{justify-content:flex-start}",
    ".bubble{max-width:82%;padding:10px 14px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-wrap:break-word}",
    ".bubble.bot{background:#f2ede4;color:#1c1c1a}",
    ".bubble.user{background:#1e3a3f;color:#faf8f3}",
    ".chips{display:flex;flex-direction:column;gap:8px;margin-top:2px}",
    ".chip{align-self:flex-start;background:transparent;border:1px solid #b8965a;color:#1e3a3f;",
    "padding:8px 12px;font-size:13px;cursor:pointer;text-align:left;transition:background .15s}",
    ".chip:hover{background:rgba(184,150,90,.12)}",
    ".typing{display:flex;gap:4px;align-items:center;padding:12px 14px;background:#f2ede4;width:fit-content}",
    ".typing span{width:6px;height:6px;border-radius:50%;background:#6b5c4e;animation:b 1s infinite}",
    ".typing span:nth-child(2){animation-delay:.15s}.typing span:nth-child(3){animation-delay:.3s}",
    "@keyframes b{0%,60%,100%{opacity:.3}30%{opacity:1}}",
    ".inputbar{display:flex;align-items:flex-end;gap:8px;padding:12px;border-top:1px solid #e8e2d8;background:#fff;flex-shrink:0}",
    "textarea{flex:1;resize:none;border:1px solid #e8e2d8;background:#faf8f3;padding:10px 12px;font-size:16px;",
    "color:#1c1c1a;outline:none;max-height:96px;line-height:1.4}",
    "textarea:focus{border-color:#b8965a}",
    ".send{width:42px;height:42px;flex-shrink:0;background:#b8965a;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center}",
    ".send:disabled{opacity:.4;cursor:default}",
    ".send svg{width:18px;height:18px}",
    ".footer{text-align:center;font-size:10px;letter-spacing:.1em;color:#6b5c4e;padding:8px;background:#fff}",
    "@media (max-width:640px){",
    ".launcher{right:18px;bottom:122px;width:44px;height:44px}",
    ".launcher svg{width:20px;height:20px}",
    ".panel{inset:0;width:100%;max-width:none;height:100dvh;max-height:100dvh;",
    "right:auto;bottom:auto;border:none;box-shadow:none}",
    ".header{padding:14px 16px;padding-top:max(14px,env(safe-area-inset-top))}",
    ".msgs{padding:16px 14px;-webkit-overflow-scrolling:touch}",
    ".bubble{font-size:15px;padding:12px 14px}",
    ".chip{font-size:15px;padding:12px 14px;min-height:44px}",
    ".inputbar{padding:10px 12px;padding-bottom:max(10px,env(safe-area-inset-bottom))}",
    "textarea{font-size:16px;line-height:1.45;padding:12px;-webkit-text-size-adjust:100%}",
    ".send{width:44px;height:44px}",
    ".footer{padding:6px 8px;padding-bottom:max(6px,env(safe-area-inset-bottom))}",
    "}",
  ].join("");
  root.appendChild(style);

  var ICON_CHAT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"/></svg>';
  var ICON_SEND =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

  // ----- build DOM -----
  var launcher = document.createElement("button");
  launcher.className = "launcher";
  launcher.setAttribute("aria-label", "Open concierge chat");
  launcher.innerHTML = ICON_CHAT;
  root.appendChild(launcher);

  var panel = document.createElement("div");
  panel.className = "panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Villa Coco concierge");
  panel.innerHTML =
    '<div class="header">' +
    '<div class="badge">' + ICON_CHAT + "</div>" +
    "<div><div class=\"title\">Villa Coco</div>" +
    '<div class="sub"><span class="dot"></span>Concierge</div></div>' +
    '<button class="close" aria-label="Close chat">&times;</button>' +
    "</div>" +
    '<div class="msgs"></div>' +
    '<div class="inputbar">' +
    '<textarea rows="1" placeholder="Ask about your stay…" aria-label="Message"></textarea>' +
    '<button class="send" aria-label="Send">' + ICON_SEND + "</button>" +
    "</div>" +
    '<div class="footer">POWERED BY ZELI TECHNOLOGIES</div>';
  root.appendChild(panel);

  var msgsEl = panel.querySelector(".msgs");
  var textarea = panel.querySelector("textarea");
  var sendBtn = panel.querySelector(".send");

  textarea.setAttribute("inputmode", "text");
  textarea.setAttribute("enterkeyhint", "send");
  textarea.setAttribute("autocomplete", "off");

  function isMobile() {
    return window.matchMedia("(max-width: 640px)").matches;
  }

  function syncPanelToViewport() {
    if (!open || !isMobile() || !window.visualViewport) return;
    var vv = window.visualViewport;
    panel.style.top = vv.offsetTop + "px";
    panel.style.left = vv.offsetLeft + "px";
    panel.style.width = vv.width + "px";
    panel.style.height = vv.height + "px";
    panel.style.bottom = "auto";
    panel.style.right = "auto";
    panel.style.maxHeight = "none";
    scrollDown();
  }

  function resetPanelLayout() {
    panel.style.top = "";
    panel.style.left = "";
    panel.style.width = "";
    panel.style.height = "";
    panel.style.bottom = "";
    panel.style.right = "";
    panel.style.maxHeight = "";
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncPanelToViewport);
    window.visualViewport.addEventListener("scroll", syncPanelToViewport);
  }

  function scrollDown() {
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function addBubble(role, text) {
    var row = document.createElement("div");
    row.className = "row " + (role === "user" ? "user" : "bot");
    var b = document.createElement("div");
    b.className = "bubble " + (role === "user" ? "user" : "bot");
    b.textContent = text;
    row.appendChild(b);
    msgsEl.appendChild(row);
    scrollDown();
  }

  function showTyping() {
    var row = document.createElement("div");
    row.className = "row bot typing-row";
    row.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
    msgsEl.appendChild(row);
    scrollDown();
    return row;
  }

  function renderChips() {
    var wrap = document.createElement("div");
    wrap.className = "chips";
    SUGGESTIONS.forEach(function (s) {
      var c = document.createElement("button");
      c.className = "chip";
      c.textContent = s;
      c.addEventListener("click", function () {
        wrap.remove();
        send(s);
      });
      wrap.appendChild(c);
    });
    msgsEl.appendChild(wrap);
    scrollDown();
  }

  function firstOpen() {
    if (msgsEl.childElementCount === 0) {
      addBubble("bot", WELCOME);
      renderChips();
    }
  }

  function setLoading(v) {
    loading = v;
    sendBtn.disabled = v || !textarea.value.trim();
  }

  async function send(textOverride) {
    var text = (textOverride != null ? textOverride : textarea.value).trim();
    if (!text || loading) return;
    var chips = msgsEl.querySelector(".chips");
    if (chips) chips.remove();

    addBubble("user", text);
    messages.push({ role: "user", content: text });
    textarea.value = "";
    textarea.style.height = "auto";
    setLoading(true);
    var typing = showTyping();

    try {
      var res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messages, sessionId: getSessionId(), visitorId: getVisitorId() }),
      });
      var data = await res.json().catch(function () {
        return {};
      });
      typing.remove();
      if (!res.ok) {
        addBubble("bot", data.error || "Sorry, something went wrong. Please try again.");
      } else {
        var reply = data.reply || "Sorry, I didn't catch that — could you rephrase?";
        addBubble("bot", reply);
        messages.push({ role: "assistant", content: reply });
      }
    } catch (e) {
      typing.remove();
      addBubble("bot", "I'm having trouble connecting right now. Please try again in a moment.");
    } finally {
      setLoading(false);
      if (!isMobile()) textarea.focus();
    }
  }

  // ----- events -----
  function toggle(state) {
    open = state != null ? state : !open;
    panel.classList.toggle("open", open);
    launcher.style.display = open ? "none" : "flex";
    if (isMobile()) {
      document.documentElement.style.overflow = open ? "hidden" : "";
      document.body.style.overflow = open ? "hidden" : "";
    }
    if (open) {
      firstOpen();
      requestAnimationFrame(syncPanelToViewport);
      // Avoid auto-focus on mobile — iOS zooms when inputs <16px get focus on open.
      if (!isMobile()) textarea.focus();
    } else {
      resetPanelLayout();
      if (isMobile()) {
        document.documentElement.style.overflow = "";
        document.body.style.overflow = "";
      }
    }
  }

  launcher.addEventListener("click", function () {
    toggle(true);
  });
  panel.querySelector(".close").addEventListener("click", function () {
    toggle(false);
  });
  sendBtn.addEventListener("click", function () {
    send();
  });
  textarea.addEventListener("input", function () {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 96) + "px";
    sendBtn.disabled = loading || !textarea.value.trim();
  });
  textarea.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  setLoading(false);
})();
