// Server-side cleanup of campaign HTML right before sending.
//
// Content pasted into the editor carries browser junk in its style attributes
// (Tailwind CSS variables like "--tw-pan-x: ;", "font-weight: bolder", "initial" values, …).
// Gmail discards the WHOLE style attribute when it contains something it does not support,
// which loses bold text and resets paragraph spacing. The frontend now saves clean HTML,
// and this pass also fixes pitches/campaigns saved earlier, so every email matches the editor.

const KEEP = new Set([
  'color', 'background-color', 'font-size', 'font-family', 'font-style', 'font-weight',
  'text-decoration', 'text-decoration-line', 'text-align', 'line-height', 'vertical-align', 'list-style-type',
  'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
  'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
  'border', 'border-left', 'border-top', 'border-bottom', 'width', 'max-width', 'height',
]);
const BAD_VALUE = /var\(|url\(|expression|javascript:|^(initial|inherit|unset|revert)$/i;

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const encode = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function hex(v) {
  const m = v.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i);
  if (!m) return v;
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return null; // fully transparent
  return '#' + [m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, '0')).join('');
}

function cleanStyle(raw) {
  const out = [];
  for (const decl of decode(raw).split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    let prop = decl.slice(0, i).trim().toLowerCase();
    let val = decl.slice(i + 1).replace(/!important/i, '').trim();
    if (!KEEP.has(prop) || !val || BAD_VALUE.test(val)) continue;

    if (prop === 'font-weight') val = /bold|bolder/i.test(val) || parseInt(val, 10) >= 600 ? 'bold' : 'normal';
    if (prop === 'text-decoration-line') prop = 'text-decoration';
    if (prop === 'text-decoration') {
      val = val.split(/\s+/).filter((d) => d === 'underline' || d === 'line-through' || d === 'none').join(' ');
      if (!val) continue;
    }
    if (prop === 'color' || prop === 'background-color') {
      val = hex(val);
      if (!val) continue;
    }
    if (prop === 'font-family') val = val.replace(/"/g, "'");
    out.push(`${prop}:${val}`);
  }
  return out.join(';');
}

export function emailSafeHtml(html = '') {
  let s = String(html)
    // classes/ids mean nothing in a mail client
    .replace(/\s(?:class|id|data-[\w-]+)\s*=\s*"[^"]*"/gi, '')
    .replace(/\s(?:class|id|data-[\w-]+)\s*=\s*'[^']*'/gi, '');

  s = s.replace(/\sstyle\s*=\s*"([^"]*)"/gi, (_, st) => {
    const c = cleanStyle(st);
    return c ? ` style="${encode(c)}"` : '';
  });

  // bold spans -> real <b> tags as well, so bold survives clients that strip styles
  s = s.replace(/<span style="([^"]*?)font-weight:bold;?([^"]*)">([\s\S]*?)<\/span>/gi, (m, a, b, inner) => {
    if (/<span/i.test(inner)) return m; // nested spans: keep as is (style is already clean)
    const rest = (a + b).replace(/;;+/g, ';').replace(/^;|;$/g, '');
    return rest ? `<span style="${rest}"><b>${inner}</b></span>` : `<b>${inner}</b>`;
  });

  // paragraphs without an explicit margin get the editor's spacing instead of the client default
  s = s.replace(/<p(\s[^>]*)?>/gi, (m, attrs = '') => {
    if (/style="[^"]*margin/i.test(attrs)) return m;
    if (/style="/i.test(attrs)) return `<p${attrs.replace(/style="/i, 'style="margin:0 0 0.9em;')}>`;
    return `<p${attrs} style="margin:0 0 0.9em">`;
  });
  return s;
}

// Plain-text part that keeps line breaks and blank lines
export function htmlToText(html = '') {
  return String(html)
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|ul|ol|table)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}