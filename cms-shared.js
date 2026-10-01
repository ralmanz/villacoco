/**
 * Villa Coco CMS — shared settings and helpers
 * Loaded by index.html and panel/index.html
 */
(function (global) {
  'use strict';

  var DEFAULT_SETTINGS = {
    bookingUrl: 'https://www.simplebooking.it/ibe2/hotel/5068?lang=EN&cur=USD',
    whatsapp: '50768583330',
    phone: '+507 6858 3330',
    email: 'relax@villacocopanama.com',
    instagramUrl: 'https://www.instagram.com/villa_coco_panama/',
    facebookUrl: 'https://www.facebook.com/villacocopanama',
  };

  function mergeSettings(raw) {
    var base = Object.assign({}, DEFAULT_SETTINGS);
    if (!raw || typeof raw !== 'object') return base;
    Object.keys(base).forEach(function (key) {
      if (typeof raw[key] === 'string' && raw[key].trim()) base[key] = raw[key].trim();
    });
    return base;
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

  function siteOriginsForNormalize() {
    var origins = [];
    if (global.location && global.location.origin) origins.push(global.location.origin);
    origins.push('https://villacoco.zeli.lat', 'https://villacocopanama.com', 'https://www.villacocopanama.com');
    origins.push('https://villacoco.pages.dev');
    return origins.filter(function (v, i, a) { return v && a.indexOf(v) === i; });
  }

  function toRelativeSitePath(value) {
    var raw = String(value || '').trim();
    if (!raw || raw.startsWith('/') || !/^https?:\/\//i.test(raw)) return raw;
    try {
      var parsed = new URL(raw);
      var path = parsed.pathname + parsed.search + parsed.hash;
      var origins = siteOriginsForNormalize();
      for (var i = 0; i < origins.length; i++) {
        var origin = origins[i];
        if (raw === origin || raw.indexOf(origin + '/') === 0) {
          return path.charAt(0) === '/' ? path : '/' + path;
        }
      }
    } catch (e) {}
    return raw;
  }

  global.VillaCocoCMS = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    mergeSettings: mergeSettings,
    whatsAppUrl: whatsAppUrl,
    mailtoUrl: mailtoUrl,
    telUrl: telUrl,
    extractPhysicalAddress: extractPhysicalAddress,
    isDevHost: isDevHost,
    toRelativeSitePath: toRelativeSitePath,
  };
})(typeof window !== 'undefined' ? window : globalThis);
