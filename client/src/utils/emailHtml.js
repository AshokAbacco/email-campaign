
// Converts what the editor SHOWS into simple, email-safe HTML.
//
// Pasted content (Gmail, Word, Docs, web pages) carries browser-specific markup such as
// <span style="font-weight: bolder">, class names, CSS variables and "margin: 0px" on every <p>.
// The editor renders that fine, but mail clients (Gmail especially) drop styles they do not
// support, so bold disappears and paragraphs get their default margins (big gaps).
// Here every element is rebuilt from its *computed* style, using only plain inline CSS
// that all mail clients understand, so the email looks exactly like the editor.

const BLOCK = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'HR']);
const INLINE = new Set(['A', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SUB', 'SUP', 'SPAN', 'CODE', 'BR', 'IMG']);
const SKIP = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA']);
const MARGIN_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'TABLE', 'HR']);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;');
const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function hex(color) {
  const m = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?\s*\)/);
  if (!m) return null;
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return null; // transparent
  return '#' + [m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, '0')).join('');
}
const px = (v) => `${Math.round(parseFloat(v) * 10) / 10}px`;
const bold = (cs) => parseInt(cs.fontWeight, 10) >= 600;

function styleFor(el, cs, ps, tag, isBlock) {
  const out = [];
  // inherited text formatting: only what differs from the parent
  if (bold(cs) !== bold(ps)) out.push(`font-weight:${bold(cs) ? 'bold' : 'normal'}`);
  if (cs.fontStyle !== ps.fontStyle) out.push(`font-style:${cs.fontStyle === 'normal' ? 'normal' : 'italic'}`);
  if (cs.color !== ps.color && hex(cs.color)) out.push(`color:${hex(cs.color)}`);
  if (cs.fontSize !== ps.fontSize) out.push(`font-size:${px(cs.fontSize)}`);
  if (cs.fontFamily !== ps.fontFamily) out.push(`font-family:${cs.fontFamily.replace(/"/g, "'")}`);
  if (el.style.lineHeight) out.push(`line-height:${cs.lineHeight === 'normal' ? 'normal' : px(cs.lineHeight)}`);

  // non-inherited formatting set on this element
  const deco = (cs.textDecorationLine || cs.textDecoration || '').split(' ').filter((d) => d === 'underline' || d === 'line-through');
  if (deco.length && tag !== 'A') out.push(`text-decoration:${deco.join(' ')}`);
  const bg = hex(cs.backgroundColor);
  if (bg) out.push(`background-color:${bg}`);
  if (cs.verticalAlign === 'super' || cs.verticalAlign === 'sub') out.push(`vertical-align:${cs.verticalAlign}`);

  if (isBlock) {
    if (cs.textAlign !== ps.textAlign && !['start', 'left'].includes(cs.textAlign)) out.push(`text-align:${cs.textAlign === 'end' ? 'right' : cs.textAlign}`);
    if (MARGIN_TAGS.has(tag)) out.push(`margin:${px(cs.marginTop)} 0 ${px(cs.marginBottom)} ${px(cs.marginLeft)}`);
    if (parseFloat(cs.paddingLeft)) out.push(`padding-left:${px(cs.paddingLeft)}`);
    if (tag === 'UL' || tag === 'OL') out.push(`list-style-type:${cs.listStyleType}`);
    if (tag === 'BLOCKQUOTE' && parseFloat(cs.borderLeftWidth)) out.push(`border-left:${px(cs.borderLeftWidth)} solid ${hex(cs.borderLeftColor) || '#d1d5db'}`);
    if ((tag === 'TD' || tag === 'TH') && parseFloat(cs.paddingTop)) out.push(`padding:${px(cs.paddingTop)} ${px(cs.paddingRight)} ${px(cs.paddingBottom)} ${px(cs.paddingLeft)}`);
  }
  if (tag === 'A') out.push(`color:${hex(cs.color) || '#2563eb'}`, `text-decoration:${deco.includes('underline') ? 'underline' : 'none'}`);
  if (tag === 'IMG') out.push('max-width:100%', 'height:auto');
  return out.join(';');
}

function attrsFor(el, tag) {
  const a = [];
  if (tag === 'A') {
    const href = el.getAttribute('href') || '';
    if (/^(https?:|mailto:)/i.test(href)) a.push(`href="${escAttr(href)}"`, 'target="_blank"');
  }
  if (tag === 'IMG') {
    const src = el.getAttribute('src') || '';
    if (!/^(https?:|data:image\/|cid:)/i.test(src)) return null;
    a.push(`src="${escAttr(src)}"`, `alt="${escAttr(el.getAttribute('alt') || '')}"`);
    if (el.width) a.push(`width="${el.width}"`);
  }
  if (tag === 'TD' || tag === 'TH') {
    for (const k of ['colspan', 'rowspan']) if (el.getAttribute(k)) a.push(`${k}="${escAttr(el.getAttribute(k))}"`);
  }
  if (tag === 'TABLE') a.push('cellpadding="0"', 'cellspacing="0"', 'border="0"');
  return a;
}

function walk(node, parentCs) {
  let html = '';
  for (const n of node.childNodes) {
    if (n.nodeType === Node.TEXT_NODE) { html += esc(n.nodeValue); continue; }
    if (n.nodeType !== Node.ELEMENT_NODE) continue;
    const src = n.tagName.toUpperCase();
    if (SKIP.has(src)) continue;
    const cs = getComputedStyle(n);
    if (cs.display === 'none') continue;
    if (src === 'BR') { html += '<br>'; continue; }

    const isBlock = BLOCK.has(src) || (!INLINE.has(src) && /block|list-item|flex|grid|table/.test(cs.display));
    // unknown tags (font, o:p, section, …) become a plain div/span
    const tag = BLOCK.has(src) || INLINE.has(src) ? (src === 'STRONG' ? 'B' : src === 'EM' ? 'I' : src === 'STRIKE' ? 'S' : src) : isBlock ? 'DIV' : 'SPAN';
    const attrs = attrsFor(n, tag);
    if (attrs === null) continue;
    const style = styleFor(n, cs, parentCs, tag, isBlock);
    let t = tag.toLowerCase();
    // bold as a real <b> tag as well, so it survives even in clients that strip styles
    let st = style;
    if (t === 'span' && /(^|;)font-weight:bold/.test(st)) { t = 'b'; st = st.replace(/(^|;)font-weight:bold/, '').replace(/^;/, ''); }

    if (tag === 'IMG') { html += `<img ${attrs.join(' ')}${style ? ` style="${escAttr(style)}"` : ''}>`; continue; }
    if (tag === 'HR') { html += `<hr style="${escAttr(style)};border:0;border-top:1px solid #d1d5db">`; continue; }

    const inner = walk(n, cs);
    // a span that changes nothing is dropped, keeping its content
    if (t === 'span' && !st) { html += inner; continue; }
    html += `<${t}${attrs.length ? ' ' + attrs.join(' ') : ''}${st ? ` style="${escAttr(st)}"` : ''}>${inner}</${t}>`;
  }
  return html;
}

// el: the live (rendered) editor element. Returns its content as email-safe HTML.
export function toEmailHtml(el) {
  if (!el) return '';
  return walk(el, getComputedStyle(el)).trim();
}