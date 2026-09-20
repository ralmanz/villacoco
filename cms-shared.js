/**
 * Villa Coco CMS — shared settings, themes, and helpers
 * Loaded by index.html and admin/index.html
 */
(function (global) {
  'use strict';

  var PRODUCTION_DOMAIN = 'https://villacocopanama.com';

  var DEFAULT_SETTINGS = {
    bookingUrl: 'https://www.simplebooking.it/ibe2/hotel/5068?lang=EN&cur=USD',
    whatsapp: '50768583330',
    phone: '+507 6858 3330',
    email: 'relax@villacocopanama.com',
    instagramUrl: 'https://www.instagram.com/villa_coco_panama/',
    facebookUrl: 'https://www.facebook.com/villacocopanama',
    activeThemeId: 'villa-coco-classic',
  };

  var THEME_REGISTRY = {
    'villa-coco-classic': {
      name: 'Villa Coco Classic',
      description: 'The approved default — warm sand, gold accents, and deep ocean teal.',
      swatches: ['#1c1c1a', '#b8965a', '#1e3a3f', '#f2ede4'],
      tokens: {
        ink: '#1c1c1a',
        bark: '#2b2420',
        sand: '#f2ede4',
        cream: '#faf8f3',
        mist: '#e8e2d8',
        gold: '#b8965a',
        ocean: '#1e3a3f',
        foam: '#c8d8d4',
        palm: '#2d4a30',
        dusk: '#6b5c4e',
        wellness: '#3d5a47',
      },
    },
    'ocean-coastal': {
      name: 'Ocean Coastal',
      description: 'Cooler Pacific blues with crisp sand tones and bright foam accents.',
      swatches: ['#152428', '#5a8a9a', '#1a4a5c', '#e8f0f2'],
      tokens: {
        ink: '#152428',
        bark: '#1a3238',
        sand: '#e8f0f2',
        cream: '#f4f9fa',
        mist: '#d4e4e8',
        gold: '#6a9aaa',
        ocean: '#1a4a5c',
        foam: '#a8ccd8',
        palm: '#2a5a48',
        dusk: '#5a7078',
        wellness: '#3a6878',
      },
    },
    'tropical-jungle': {
      name: 'Tropical Jungle',
      description: 'Lush greens and palm shadows with golden sunlight highlights.',
      swatches: ['#1a2418', '#c4a050', '#2d5030', '#eef2e4'],
      tokens: {
        ink: '#1a2418',
        bark: '#243020',
        sand: '#eef2e4',
        cream: '#f6f8f0',
        mist: '#dce6d0',
        gold: '#c4a050',
        ocean: '#2a4840',
        foam: '#b8d4b0',
        palm: '#3d6838',
        dusk: '#6a5840',
        wellness: '#4a7048',
      },
    },
    'sunset-earth': {
      name: 'Sunset Earth',
      description: 'Warm terracotta dusk tones with soft cream and amber gold.',
      swatches: ['#2a2018', '#c89050', '#5a3828', '#f5ece0'],
      tokens: {
        ink: '#2a2018',
        bark: '#3a2a20',
        sand: '#f5ece0',
        cream: '#faf6f0',
        mist: '#e8ddd0',
        gold: '#c89050',
        ocean: '#4a3830',
        foam: '#d8c8b8',
        palm: '#4a5030',
        dusk: '#8a6848',
        wellness: '#6a5840',
      },
    },
  };

  var TOKEN_KEYS = ['ink', 'bark', 'sand', 'cream', 'mist', 'gold', 'ocean', 'foam', 'palm', 'dusk', 'wellness'];

  function mergeSettings(raw) {
    var base = Object.assign({}, DEFAULT_SETTINGS);
    if (!raw || typeof raw !== 'object') return base;
    Object.keys(base).forEach(function (key) {
      if (typeof raw[key] === 'string' && raw[key].trim()) base[key] = raw[key].trim();
    });
    if (!THEME_REGISTRY[base.activeThemeId]) base.activeThemeId = DEFAULT_SETTINGS.activeThemeId;
    return base;
  }

  function resolveThemeId(settings) {
    var id = settings && settings.activeThemeId;
    return THEME_REGISTRY[id] ? id : DEFAULT_SETTINGS.activeThemeId;
  }

  function applyThemeToRoot(root, themeId) {
    if (!root) return;
    var theme = THEME_REGISTRY[themeId] || THEME_REGISTRY[DEFAULT_SETTINGS.activeThemeId];
    TOKEN_KEYS.forEach(function (key) {
      if (theme.tokens[key]) root.style.setProperty('--' + key, theme.tokens[key]);
    });
  }

  function whatsAppUrl(number) {
    var digits = String(number || '').replace(/\D/g, '');
    return digits ? 'https://wa.me/' + digits : '';
  }

  function mailtoUrl(email) {
    var value = String(email || '').trim();
    return value ? 'mailto:' + value : '';
  }

  function telUrl(phone) {
    var value = String(phone || '').trim();
    if (!value) return '';
    var digits = value.replace(/\D/g, '');
    return digits ? 'tel:+' + digits : '';
  }

  function stripHtmlText(line) {
    return String(line || '').replace(/<[^>]+>/g, '').trim();
  }

  function splitAddressLines(addressHtml) {
    return String(addressHtml || '')
      .replace(/\r\n/g, '\n')
      .split(/<br\s*\/?>/gi)
      .map(function (line) { return line.trim(); });
  }

  function isEmailLine(line) {
    var text = stripHtmlText(line);
    return text.indexOf('@') !== -1 && text.indexOf('.') !== -1;
  }

  function isPhoneLine(line) {
    var text = stripHtmlText(line);
    if (!text) return false;
    var digits = text.replace(/\D/g, '');
    return digits.length >= 7 && /^[\d\s+\-().]+$/.test(text);
  }

  /** Strip legacy email/phone lines from combined footer.address values. */
  function extractPhysicalAddress(addressHtml) {
    var lines = splitAddressLines(addressHtml);
    while (lines.length && !stripHtmlText(lines[lines.length - 1])) lines.pop();
    while (lines.length && (isEmailLine(lines[lines.length - 1]) || isPhoneLine(lines[lines.length - 1]))) {
      lines.pop();
    }
    while (lines.length && !stripHtmlText(lines[lines.length - 1])) lines.pop();
    return lines.join('<br>');
  }

  function isDevHost() {
    var host = global.location && global.location.hostname;
    if (!host) return false;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    return (global.location.search || '').indexOf('dev=1') !== -1;
  }

  global.VillaCocoCMS = {
    PRODUCTION_DOMAIN: PRODUCTION_DOMAIN,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    THEME_REGISTRY: THEME_REGISTRY,
    TOKEN_KEYS: TOKEN_KEYS,
    mergeSettings: mergeSettings,
    resolveThemeId: resolveThemeId,
    applyThemeToRoot: applyThemeToRoot,
    whatsAppUrl: whatsAppUrl,
    mailtoUrl: mailtoUrl,
    telUrl: telUrl,
    extractPhysicalAddress: extractPhysicalAddress,
    isDevHost: isDevHost,
  };
})(typeof window !== 'undefined' ? window : globalThis);
