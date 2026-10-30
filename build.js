#!/usr/bin/env node
/*
 * Finding North - build script
 *
 * Turns tekst.md into the pages of the site. Run it with:   node build.js
 * Needs only Node.js, no packages.
 *
 * One page per chapter: index.html (cover and "How to read"), chapter-1.html
 * to chapter-4.html, references.html and appendices.html.
 *
 * All text comes from tekst.md. The few things that are not in tekst.md
 * (display headings, compass directions, photos, "To come" boxes) are set
 * in SETTINGS below.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;

const SETTINGS = {
  source: 'tekst.md',
  outDir: '.',

  cover: {
    title: 'Finding North.',
    photo: 'fotos/kaleidoscope-cover.png',
    photoAlt: 'The kaleidoscope on a dark grey background, next to the handwritten words: Look through it. What do you see? Now ask the person next to you.',
    // The whole photo is shown (not cut to a strip) on a band in the photo's own background colour.
    photoFit: 'contain',
    photoBackground: '#424242',
    quote: "I decide to look through someone else's kaleidoscope before I lead them.",
    institution: 'NHL Stenden',
  },

  // Big heading per section. The title from tekst.md becomes the small label above it.
  headings: {
    '1.2': 'Ask first.',
    '1.3': 'From learning to doing.',
    '1.4': 'Understand the situation first.',
    '1.5': 'Yes, but only if people grow.',
    '2.2': 'I waited instead of asking.',
    '3.1': 'Ask, decide and explain.',
    '3.2': '"I have always done it like this."',
    '4': 'A leader needs a team.',
  },

  // Orange point of the compass at each chapter heading: 'N', 'E', 'S', 'W', or null for none.
  chapterCompass: { 1: 'N', 2: null, 3: 'N', 4: 'N' },

  // Sections that are not in tekst.md yet. As soon as tekst.md has a heading
  // with this number (for example "### 2.1 ..."), that text is used instead.
  toCome: [
    { num: '2.1', title: 'The applied research project', note: 'Group work, added separately.' },
    { num: '2.3', title: 'The group account of the research', note: 'Group work, added separately.' },
  ],

  // Paragraphs of tekst.md that are left out (matched on the start of the paragraph).
  omit: [
    { section: '1.2', startsWith: '**Reflection after the pitch.**' }, // 1.2.5 is not part of this portfolio
    { startsWith: '&#91;2.1 The applied research project' },           // shown as the 2.1 and 2.3 boxes
    { section: 'Appendix B', startsWith: '**' },                       // Appendix B keeps only its first paragraph
  ],

  // Photos: the text after "image:" in tekst.md, the file in fotos/ and a short alt text.
  photos: [
    { match: 'The village festival in Warns', file: 'fotos/figure-1-village-festival.jpg', alt: 'Crowds at the village festival in Warns' },
    { match: 'Skiing in Austria', file: 'fotos/figure-2-austria.jpg', alt: 'Skiers on a snowy mountain slope in Austria' },
    { match: 'My North artefact, the kaleidoscope with the card next to it', file: 'fotos/figure-3-kaleidoscope-card.jpg', alt: 'The kaleidoscope with the handwritten card next to it' },
    { match: 'Our film night group', file: 'fotos/figure-4-film-night.jpg', alt: "The film night group together at Sander's place" },
    { match: 'My notes with the original learning question', file: 'fotos/appendix-a-learning-question.jpg', alt: 'Screenshot of my notes with the original learning question' },
    { match: 'Change Journey assignment card', file: 'fotos/figure-d1-assignment-card.jpg', alt: 'Photo of the Change Journey assignment card' },
    { match: 'The letter from Sod', file: 'fotos/figure-d2-letter-from-sod.jpg', alt: 'Photo of the letter from Sod, the toddler' },
    { match: 'Our Change Journey poster', file: 'fotos/figure-d3-poster.jpg', alt: "Our team's poster for Sod with drawings and pictures" },
    { match: 'Chat with the store manager, part 1', file: 'fotos/figure-e1-chat-part-1.jpg', alt: "Chat screenshot with my question and the first part of the store manager's answer" },
    { match: 'Chat with the store manager, part 2', file: 'fotos/figure-e2-chat-part-2.jpg', alt: "Chat screenshot with the second part of the store manager's answer" },
  ],

  // Short names in the navigation bar (by section id).
  navLabels: { 'how-to-read': 'How to read' },
};

const warnings = [];
const warn = (msg) => warnings.push(msg);

// ---------------------------------------------------------------------------
// 1. Reading tekst.md into blocks and a tree of parts, sections and subsections
// ---------------------------------------------------------------------------

function readBlocks(md) {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const isHeading = (l) => /^#{1,6}\s/.test(l);
  const isTable = (l) => /^\s*\|/.test(l);
  const isOl = (l) => /^\d+\.\s+/.test(l);
  const isUl = (l) => /^[-*+]\s+/.test(l);
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (isHeading(line)) {
      const m = line.match(/^(#{1,6})\s+(.*?)\s*$/);
      blocks.push({ type: 'heading', level: m[1].length, text: m[2] });
      i++;
    } else if (isTable(line)) {
      const rows = [];
      while (i < lines.length && isTable(lines[i])) rows.push(lines[i++]);
      blocks.push(readTable(rows));
    } else if (isOl(line) || isUl(line)) {
      const ordered = isOl(line);
      const start = ordered ? Number(line.match(/^(\d+)/)[1]) : 1;
      const items = [];
      while (i < lines.length && (ordered ? isOl(lines[i]) : isUl(lines[i]))) {
        items.push(lines[i].replace(ordered ? /^\d+\.\s+/ : /^[-*+]\s+/, '').trim());
        i++;
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', start, items });
    } else {
      const text = [];
      while (i < lines.length && lines[i].trim() && !isHeading(lines[i]) && !isTable(lines[i])) text.push(lines[i++].trim());
      blocks.push({ type: 'p', text: text.join(' ') });
    }
  }
  return blocks;
}

function splitRow(row) {
  let s = row.trim().replace(/^\|/, '');
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = [];
  let cur = '';
  for (let k = 0; k < s.length; k++) {
    if (s[k] === '\\' && s[k + 1] === '|') { cur += '|'; k++; }
    else if (s[k] === '|') { cells.push(cur.trim()); cur = ''; }
    else cur += s[k];
  }
  cells.push(cur.trim());
  return cells;
}

function readTable(rows) {
  const isRule = (r) => /^\s*\|?(\s*:?-{3,}:?\s*\|)*\s*:?-{3,}:?\s*\|?\s*$/.test(r);
  return {
    type: 'table',
    header: splitRow(rows[0]),
    rows: rows.slice(1).filter((r) => !isRule(r)).map(splitRow),
  };
}

const usedIds = new Set();
function uniqueId(base) {
  let id = base || 'section';
  for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
  usedIds.add(id);
  return id;
}

function slug(text) {
  return String(text).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function newPart(text) {
  let m;
  if ((m = text.match(/^Chapter\s+(\d+)\s*·\s*(.+)$/))) {
    return { kind: 'chapter', n: Number(m[1]), label: `Chapter ${m[1]}`, title: m[2], id: uniqueId(`chapter-${m[1]}`), blocks: [], sections: [] };
  }
  const kind = /^references$/i.test(text) ? 'references' : /^appendices$/i.test(text) ? 'appendices' : 'part';
  const id = /^how to read/i.test(text) ? 'how-to-read' : slug(text);
  return { kind, title: text, id: uniqueId(id), blocks: [], sections: [] };
}

function newSection(text, part) {
  let m, num = null, title = text, kind = 'section', id;
  if ((m = text.match(/^(Appendix\s+[A-Z])\s*·\s*(.+)$/))) { num = m[1]; title = m[2]; kind = 'appendix'; }
  else if ((m = text.match(/^How I have shown (LO\d+)$/i))) { num = m[1].toUpperCase(); kind = 'lo'; }
  else if ((m = text.match(/^(\d+(?:\.\d+)*)\s+(.+)$/))) { num = m[1]; title = m[2]; }
  else if ((m = text.match(/^(.+?)\s*\((\d+(?:\.\d+)*)\)$/))) { num = m[2]; title = m[1]; }
  if (kind === 'lo') id = num.toLowerCase();
  else if (kind === 'appendix') id = slug(num);
  else if (num) id = 's' + num.replace(/\./g, '-');
  else id = slug(title.replace(/\s*\(.*\)$/, ''));
  return { kind, num, title, display: num ? SETTINGS.headings[num] || null : null, id: uniqueId(id), blocks: [], subs: [], part };
}

function newSub(text) {
  let m, label = null, title = text, id;
  if ((m = text.match(/^(\d+(?:\.\d+)+)\s+(.+)$/))) { label = m[1]; title = m[2]; id = 's' + label.replace(/\./g, '-'); }
  else if ((m = text.match(/^(Story\s+\d+)\.\s+(.+)$/))) { label = m[1]; title = m[2]; }
  else if ((m = text.match(/^(.+?)\s*·\s*(.+)$/))) { label = m[1]; title = m[2]; }
  return { label, title, id: uniqueId(id || slug(label || title)), blocks: [] };
}

function buildTree(blocks) {
  const doc = { title: '', front: [], parts: [] };
  let part = null, section = null, sub = null;
  for (const b of blocks) {
    if (b.type === 'heading') {
      if (b.level === 1) { doc.title = b.text; continue; }
      if (b.level === 2) { part = newPart(b.text); doc.parts.push(part); section = sub = null; continue; }
      if (part && (b.level === 3 || !section)) { section = newSection(b.text, part); part.sections.push(section); sub = null; continue; }
      if (section) { sub = newSub(b.text); section.subs.push(sub); continue; }
    }
    const target = sub || section || part;
    (target ? target.blocks : doc.front).push(b);
  }
  return doc;
}

function compareNum(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let k = 0; k < Math.max(pa.length, pb.length); k++) {
    const d = (pa[k] || 0) - (pb[k] || 0);
    if (d) return d;
  }
  return 0;
}

function applySettings(doc) {
  const keep = (b, num) => !(b.type === 'p' && SETTINGS.omit.some((o) => b.text.startsWith(o.startsWith) && (!o.section || o.section === num)));
  for (const part of doc.parts) {
    part.blocks = part.blocks.filter((b) => keep(b, null));
    for (const s of part.sections) {
      s.blocks = s.blocks.filter((b) => keep(b, s.num));
      for (const sub of s.subs) sub.blocks = sub.blocks.filter((b) => keep(b, s.num));
    }
  }
  for (const item of SETTINGS.toCome) {
    const part = doc.parts.find((p) => p.kind === 'chapter' && p.n === Number(item.num.split('.')[0]));
    if (!part || part.sections.some((s) => s.num === item.num)) continue;
    const s = newSection(`${item.num} ${item.title}`, part);
    s.toCome = item.note || '';
    let at = part.sections.findIndex((x) => x.kind === 'lo' || (x.num && /^\d/.test(x.num) && compareNum(x.num, item.num) > 0));
    if (at < 0) at = part.sections.length;
    part.sections.splice(at, 0, s);
  }
  for (const num of Object.keys(SETTINGS.headings)) {
    if (!doc.parts.some((p) => p.sections.some((s) => s.num === num))) warn(`Heading set for ${num}, but tekst.md has no section ${num}.`);
  }
}

// ---------------------------------------------------------------------------
// 2. Inline text: bold, italic, links, placeholders, quotes and cross-references
// ---------------------------------------------------------------------------

const OPEN = '';  // "[" of a placeholder such as \[to check\]
const CLOSE = ''; // "]" of a placeholder
const STAR = '';  // a literal *

function decodeEntities(s) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return named[e.toLowerCase()] ?? m;
  });
}

function smartQuotes(s) {
  return s.split(/(https?:\/\/[^\s<>)\]]+)/).map((part, k) => (k % 2 ? part : part
    .replace(/(^|[\s(\[{—–*])"/g, '$1“')
    .replace(/"/g, '”')
    .replace(/([A-Za-z0-9À-ɏ])'([A-Za-zÀ-ɏ])/g, '$1’$2')
    .replace(/(^|[\s(\[{—–*])'/g, '$1‘')
    .replace(/'/g, '’'))).join('');
}

// Raw markdown text -> text with placeholder markers, real characters and curly quotes.
function prep(raw) {
  const s = String(raw)
    .replace(/&#91;/g, OPEN).replace(/&#93;/g, CLOSE)
    .replace(/\\\[/g, OPEN).replace(/\\\]/g, CLOSE)
    .replace(/\\\*/g, STAR)
    .replace(/\\([\\`_{}()#+\-.!|<>"'~])/g, '$1');
  return smartQuotes(decodeEntities(s));
}

const escapeHTML = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => escapeHTML(s).replace(/"/g, '&quot;');
const plain = (s) => String(s).replace(/\*\*|\*/g, '').replace(new RegExp(`[${OPEN}${CLOSE}]`, 'g'), '');

const TOKEN = new RegExp([
  '<(https?://[^>\\s]+)>',
  '\\[([^\\]\\uE000\\uE001]+)\\]\\(([^)\\s]+)\\)',
  '\\*\\*(.+?)\\*\\*',
  '\\*([^*\\s](?:[^*]*[^*\\s])?)\\*',
  '(https?://[^\\s<>\\uE000\\uE001]*[^\\s<>.,;:!?)\\]\\uE000\\uE001\\u201D\\u2019])',
  '\\uE000([^\\uE000\\uE001]*)\\uE001',
].join('|'), 'g');

function inline(s, ctx) {
  const re = new RegExp(TOKEN.source, 'g');
  const inner = { ...ctx, noXref: true };
  let out = '', last = 0, m;
  while ((m = re.exec(s))) {
    out += textHTML(s.slice(last, m.index), ctx);
    if (m[1]) out += linkHTML(m[1], escapeHTML(m[1]));
    else if (m[2] !== undefined) out += linkHTML(m[3], inline(m[2], inner));
    else if (m[4] !== undefined) out += `<strong>${inline(m[4], ctx)}</strong>`;
    else if (m[5] !== undefined) out += `<em>${inline(m[5], ctx)}</em>`;
    else if (m[6]) out += linkHTML(m[6], escapeHTML(m[6]));
    else if (m[7] !== undefined) out += ctx.refs ? `[${inline(m[7], ctx)}]` : `<span class="todo-inline">${inline(m[7], ctx)}</span>`;
    last = re.lastIndex;
  }
  return out + textHTML(s.slice(last), ctx);
}

function textHTML(s, ctx) {
  let html = escapeHTML(s).replace(new RegExp(STAR, 'g'), '*');
  if (!ctx.noXref && !ctx.refs) html = crossRefs(html, ctx);
  return html;
}

function linkHTML(href, html) {
  const internal = href.startsWith('#');
  return `<a href="${escapeAttr(href)}"${internal ? '' : ' target="_blank" rel="noopener"'}>${html}</a>`;
}

// Link to something anywhere on the site: "#id" on the same page, "page.html#id" on another page.
function hrefTo(id, ctx) {
  const file = ctx.pageOf && ctx.pageOf.get(id);
  if (!file) return null;
  return file === ctx.file ? `#${id}` : `${file}#${id}`;
}

// Turns "Appendix B", "Figure 3", "Story 4" and "(see 1.3)" into links to that part of the site.
function crossRefs(html, ctx) {
  const a = (id, text) => {
    const href = hrefTo(id, ctx);
    return href ? `<a class="xref" href="${href}">${text}</a>` : text;
  };
  return html
    .replace(/\bAppendix ([A-Z])\b/g, (m, x) => a(`appendix-${x.toLowerCase()}`, m))
    .replace(/\bFigure ([A-Z]?\d+)\b/g, (m, x) => a(`figure-${x.toLowerCase()}`, m))
    .replace(/\bStory (\d+)\b/g, (m, x) => a(`story-${x}`, m))
    .replace(/\((see )?(\d+\.\d+(?:\.\d+)?)(?=[,)\s])/g, (m, see, n) => `(${see || ''}${a('s' + n.replace(/\./g, '-'), n)}`);
}

// ---------------------------------------------------------------------------
// 3. Small graphic pieces: compass, triangles, icons
// ---------------------------------------------------------------------------

const DIRS = { east: 'E', west: 'W', south: 'S', north: 'N' };
const DIR_NAMES = { N: 'North', E: 'East', S: 'South', W: 'West' };
const dirOf = (text) => DIRS[(String(text).match(/^(East|West|South|North)\b/i) || [])[1]?.toLowerCase()] || null;
const dirInText = (text) => DIRS[(String(text).match(/On the compass, I stood on (East|West|South|North)\b/i) || [])[1]?.toLowerCase()] || null;

const ARMS = {
  N: { tip: '120,46', ccw: '107,107', cw: '133,107' },
  E: { tip: '194,120', ccw: '133,107', cw: '133,133' },
  S: { tip: '120,194', ccw: '133,133', cw: '107,133' },
  W: { tip: '46,120', ccw: '107,133', cw: '107,107' },
};
const LETTERS = { N: [120, 17], E: [223, 121], S: [120, 224], W: [17, 121] };

// size: 'lg' (with letters), 'md' or 'sm' (small, bolder lines)
function compassSVG(active, size, label) {
  let arms = '';
  for (const d of ['N', 'E', 'S', 'W']) {
    const on = d === active;
    arms += `<path class="${on ? 'c-act-a' : 'c-a'}" d="M120,120L${ARMS[d].tip}L${ARMS[d].ccw}Z"/>`;
    arms += `<path class="${on ? 'c-act-b' : 'c-b'}" d="M120,120L${ARMS[d].tip}L${ARMS[d].cw}Z"/>`;
  }
  const letters = size === 'lg'
    ? Object.entries(LETTERS).map(([d, [x, y]]) => `<text class="c-letter${d === active ? ' on' : ''}" x="${x}" y="${y}">${d}</text>`).join('')
    : '';
  const small = size === 'sm';
  const a11y = label ? `role="img" aria-label="${escapeAttr(label)}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="compass compass--${size}" viewBox="${size === 'lg' ? '0 0 240 240' : '28 28 184 184'}" ${a11y}>`
    + `<circle class="c-ring" cx="120" cy="120" r="${small ? 85 : 87}"${small ? ' stroke-width="12"' : ''}/>`
    + (small ? '' : '<circle class="c-ring2" cx="120" cy="120" r="77"/>')
    + arms
    + `<circle class="c-hub" cx="120" cy="120" r="${small ? 13 : 6.5}"/>`
    + letters + '</svg>';
}

const TRIANGLES = '<svg class="tris" viewBox="0 0 38 10" aria-hidden="true" focusable="false"><path d="M0 10 5.5 0 11 10Z"/><path d="M13.5 10 19 0 24.5 10Z"/><path d="M27 10 32.5 0 38 10Z"/></svg>';

function triangleBand(id) {
  return `<svg class="tri-band" width="100%" height="9" aria-hidden="true" focusable="false"><defs><pattern id="${id}" width="42" height="9" patternUnits="userSpaceOnUse">`
    + '<path class="t-navy" d="M1 9 7 0l6 9Z"/><path class="t-navy" d="M15 9l6-9 6 9Z"/><path class="t-orange" d="M29 9l6-9 6 9Z"/>'
    + `</pattern></defs><rect width="100%" height="9" fill="url(#${id})"/></svg>`;
}

const ICON_MOON = '<svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1Z"/></svg>';
const ICON_SUN = '<svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>';

// ---------------------------------------------------------------------------
// 4. Photos
// ---------------------------------------------------------------------------

function exifOrientation(buf) {
  let off = 2;
  while (off + 4 < buf.length && buf[off] === 0xff) {
    const marker = buf[off + 1];
    const len = buf.readUInt16BE(off + 2);
    if (marker === 0xe1 && buf.toString('latin1', off + 4, off + 10) === 'Exif\0\0') {
      const t = off + 10;
      const le = buf.toString('latin1', t, t + 2) === 'II';
      const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
      const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
      const ifd = t + u32(t + 4);
      for (let k = 0, n = u16(ifd); k < n; k++) {
        const e = ifd + 2 + k * 12;
        if (u16(e) === 0x0112) return u16(e + 8);
      }
      return 1;
    }
    if (marker === 0xda) break;
    off += 2 + len;
  }
  return 1;
}

function imageSize(file) {
  const buf = fs.readFileSync(file);
  if (buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG') return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) { off++; continue; }
      const marker = buf[off + 1];
      if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) { off += 2; continue; }
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        const h = buf.readUInt16BE(off + 5), w = buf.readUInt16BE(off + 7);
        return exifOrientation(buf) >= 5 ? { w: h, h: w } : { w, h };
      }
      off += 2 + buf.readUInt16BE(off + 2);
    }
  }
  return null;
}

const norm = (s) => plain(s).toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').replace(/\.$/, '').trim();

function photo(file, alt, label) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) { warn(`Photo not found: ${file} (${label})`); return null; }
  const size = imageSize(abs);
  if (!size) { warn(`Cannot read the size of ${file}`); return null; }
  return { file, alt, ...size };
}

function findPhoto(text) {
  const entry = SETTINGS.photos.find((p) => norm(p.match) === norm(text));
  if (!entry) { warn(`No photo set for "[image: ${plain(text)}]". Add it to SETTINGS.photos in build.js.`); return null; }
  return photo(entry.file, entry.alt || plain(text), plain(text));
}

// ---------------------------------------------------------------------------
// 5. Blocks to HTML
// ---------------------------------------------------------------------------

const cls = (...names) => names.filter(Boolean).join(' ');
const figureLabelOf = (t) => {
  const m = t.match(/^\*\*(Figure\s+([A-Z]?\d+)\.?)\*\*\s*\*(.+)\*$/);
  return m ? { label: m[1], id: `figure-${m[2].toLowerCase()}`, title: m[3] } : null;
};
const imageOf = (t) => (t.match(/^image:\s*(.+?)$/i) || [])[1] || null;

function renderBlocks(blocks, ctx) {
  let html = '';
  let pair = false; // the next block sits next to a side heading
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const extra = cls(pair && 'has-side');
    pair = false;
    if (b.type === 'p') {
      const t = prep(b.text);
      if (figureLabelOf(t) || imageOf(t)) {
        const group = collectFigures(blocks, i);
        html += renderFigures(group, ctx, extra);
        i = group.end - 1;
        continue;
      }
      const r = renderParagraph(t, ctx, cls(extra, ctx.lead && i === 0 && 'lead'));
      html += r.html;
      pair = Boolean(r.sideOnly);
    } else if (b.type === 'table') html += renderTable(b, ctx, extra);
    else if (b.type === 'ol' || b.type === 'ul') html += renderList(b, ctx, extra);
  }
  return html;
}

function para(t, ctx, c) {
  return `<p${c ? ` class="${c}"` : ''}>${inline(t, ctx)}</p>`;
}

// In a quote, " / " marks the end of a line, as when quoting a poem.
function quote(q, ctx, c) {
  return `<blockquote class="${cls('quote', c)}">${TRIANGLES}<p>${inline(q, ctx).replace(/ \/ /g, '<br>')}</p></blockquote>`;
}

function todoBox(text, ctx, c) {
  return `<div class="${cls('todo', c)}"><p class="kicker">To come</p><p>${inline(text, ctx)}</p></div>`;
}

function renderParagraph(t, ctx, c) {
  let m;
  // "This story belongs on East because ..." -> panel
  if ((m = t.match(/^This story belongs on (East|West|South|North)\b/))) {
    return { html: `<div class="${cls('panel panel--why', c)}"><p class="kicker">Why on ${m[1]}</p><p>${inline(t, ctx)}</p></div>` };
  }
  // A paragraph that starts with a bold lead-in: the lead-in becomes a side heading
  if ((m = t.match(/^\*\*([^*]+?)\*\*\s*(.*)$/))) {
    const head = m[1], rest = m[2];
    if (/^What I have decided\.?$/i.test(head)) {
      return { html: `<div class="${cls('panel panel--decided', c)}"><p class="kicker">${inline(head.replace(/\.$/, ''), ctx)}</p><p>${inline(rest, ctx)}</p></div>` };
    }
    const dir = dirOf(head) || dirInText(rest);
    const side = `<p class="${cls('side', dir && 'side--compass', c)}">${dir ? compassSVG(dir, 'sm') : ''}<span>${inline(head, ctx)}</span></p>`;
    if (!rest) return { html: side, sideOnly: true };
    return { html: side + body(rest, ctx, cls('has-side', c)) };
  }
  // The question I asked: "..."
  if ((m = t.match(/^([^“”*]{3,80}:)\s*(“[^“”]+”)$/))) {
    return { html: para(m[1], ctx, c) + quote(m[2], ctx) };
  }
  return { html: body(t, ctx, c) };
}

function body(t, ctx, c) {
  let m;
  if (/^“[^“”]+”$/.test(t)) return quote(t, ctx, c);
  if ((m = t.match(/^\*([^*]+)\*$/))) return `<p class="${cls('statement', c)}">${inline(m[1], ctx)}</p>`;
  if ((m = t.match(/^([^]+)$/))) return todoBox(m[1], ctx, c);
  // a long placeholder at the end of a paragraph gets its own box
  if ((m = t.match(/^(.*\S)\s+([^]{25,})$/))) return para(m[1], ctx, c) + todoBox(m[2], ctx);
  // a quotation with a citation at the end, like "..." (Hanson, n.d.), is set as a quote
  if ((m = t.match(/^(.*\S)\s+(“[^“”]+”\s*\([^()]+\)\.?)$/))) return para(m[1], ctx, c) + quote(m[2], ctx);
  return para(t, ctx, c);
}

function collectFigures(blocks, i) {
  const figs = [];
  let k = i, note = null;
  while (k < blocks.length && blocks[k].type === 'p') {
    const t = prep(blocks[k].text);
    const label = figureLabelOf(t);
    if (label) {
      const next = blocks[k + 1] && blocks[k + 1].type === 'p' ? imageOf(prep(blocks[k + 1].text)) : null;
      figs.push({ ...label, image: next });
      k += next ? 2 : 1;
      continue;
    }
    const image = imageOf(t);
    if (!image) break;
    figs.push({ label: null, id: null, title: null, image });
    k++;
  }
  if (k < blocks.length && blocks[k].type === 'p') {
    const m = prep(blocks[k].text).match(/^Note\.\s+(.+)$/);
    if (m) { note = m[1]; k++; }
  }
  return { figs, note, end: k };
}

function figureHTML(f, ctx, noteHTML, c) {
  const nox = { ...ctx, noXref: true };
  const cap = f.label ? `<figcaption><span class="fig-label">${inline(f.label, nox)}</span> <span class="fig-title">${inline(f.title, nox)}</span></figcaption>` : '';
  let media;
  if (f.photo) {
    const caption = f.label ? `${plain(f.label)} ${plain(f.title)}` : plain(f.photo.alt);
    media = `<a class="fig-media" href="${escapeAttr(f.photo.file)}" data-lightbox data-caption="${escapeAttr(caption)}">`
      + `<img src="${escapeAttr(f.photo.file)}" alt="${escapeAttr(f.photo.alt)}" width="${f.photo.w}" height="${f.photo.h}" loading="lazy" decoding="async"></a>`;
  } else {
    media = `<div class="todo"><p class="kicker">Photo to come</p><p>${inline(f.image || '', ctx)}</p></div>`;
  }
  return `<figure class="${cls('fig', c)}"${f.id ? ` id="${f.id}"` : ''}>${cap}${media}${noteHTML}</figure>`;
}

function renderFigures(group, ctx, c) {
  const items = group.figs.map((f) => ({ ...f, photo: f.image ? findPhoto(f.image) : null }));
  const noteHTML = group.note ? `<p class="fig-note"><em>Note.</em> ${inline(group.note, ctx)}</p>` : '';
  const ratio = (f) => (f.photo ? f.photo.w / f.photo.h : 1.4);
  if (items.length === 1) {
    const f = items[0];
    const shape = !f.photo ? '' : ratio(f) < 0.95 ? 'fig--portrait' : f.photo.w >= 1400 ? 'wide' : '';
    return figureHTML(f, ctx, noteHTML, cls(shape, c));
  }
  // Landscape photos get a row of their own, upright photos stand in pairs at the same height.
  const rows = [];
  let pending = [];
  for (const f of items) {
    if (ratio(f) > 1.25) {
      if (pending.length) rows.push(pending);
      pending = [];
      rows.push([f]);
    } else {
      pending.push(f);
      if (pending.length === 2) { rows.push(pending); pending = []; }
    }
  }
  if (pending.length) rows.push(pending);
  const rowsHTML = rows.map((row) => {
    const columns = row.length === 1 ? '1fr' : row.map((f) => `${ratio(f).toFixed(3)}fr`).join(' ');
    return `<div class="fig-row" style="grid-template-columns:${columns}">${row.map((f) => figureHTML(f, ctx, '')).join('')}</div>`;
  }).join('');
  return `<div class="${cls('fig-group wide', c)}">${rowsHTML}${noteHTML}</div>`;
}

function renderTable(tb, ctx, c) {
  const first = plain(prep(tb.header[0])).toLowerCase();
  if (first === 'compass position') return storyMeta(tb, ctx, c);
  if (first === 'point' && tb.header.length >= 3) return compassKey(tb, ctx, c);
  const overview = first === 'no.';
  const head = tb.header.map((h) => `<th scope="col">${inline(prep(h), ctx)}</th>`).join('');
  const rows = tb.rows.map((r) => '<tr>' + r.map((cell, k) => {
    const t = prep(cell);
    if (k > 0) return `<td>${inline(t, ctx)}</td>`;
    return `<th scope="row">${overview ? overviewLink(t, ctx) : inline(t, ctx)}</th>`;
  }).join('') + '</tr>').join('');
  const wide = tb.header.length >= 3 ? 'wide' : '';
  return `<div class="${cls('table-wrap', wide, c)}"><table class="${cls(`t-cols-${tb.header.length}`, overview && 't-overview')}"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

// "1.2", "2.1 to 2.3", "Choice" in the overview table link to that section.
function overviewLink(t, ctx) {
  const nox = { ...ctx, noXref: true };
  const m = t.match(/^(\d+(?:\.\d+)?)\b/);
  let id = m ? 's' + m[1].replace(/\./g, '-') : null;
  if (!id || !ctx.pageOf.has(id)) id = ctx.titleIds.get(plain(t).toLowerCase()) || null;
  const href = id ? hrefTo(id, ctx) : null;
  return href ? `<a href="${href}">${inline(t, nox)}</a>` : inline(t, nox);
}

function storyMeta(tb, ctx, c) {
  const rows = [tb.header, ...tb.rows];
  const dir = dirOf(plain(prep(tb.header[1])));
  const items = rows.map((r) => `<div><dt>${inline(prep(r[0]), ctx)}</dt><dd>${inline(prep(r[1] || ''), ctx)}</dd></div>`).join('');
  return `<p class="${cls('side side--meta', c)}">${dir ? compassSVG(dir, 'md') : ''}</p><dl class="${cls('story-meta has-side', c)}">${items}</dl>`;
}

function compassKey(tb, ctx, c) {
  const cells = tb.rows.map((r) => {
    const d = DIRS[plain(prep(r[0])).toLowerCase()] || 'x';
    return `<div class="ck ck--${d.toLowerCase()}"><p class="kicker">${inline(prep(r[0]), ctx)}</p>`
      + `<p class="ck-meaning">${inline(prep(r[1] || ''), ctx)}</p><p class="ck-q">${inline(prep(r[2] || ''), ctx)}</p></div>`;
  }).join('');
  const legend = tb.header.map((h) => inline(prep(h), ctx)).join(' <span aria-hidden="true">·</span> ');
  return `<div class="${cls('compass-key wide', c)}"><p class="ck-legend">${legend}</p><div class="ck-grid">${cells}`
    + `<div class="ck ck--c">${compassSVG(null, 'lg', 'Compass with the four points')}</div></div></div>`;
}

function renderList(b, ctx, c) {
  const items = b.items.map((it) => `<li>${inline(prep(it), ctx)}</li>`).join('');
  const start = b.type === 'ol' && b.start !== 1 ? ` start="${b.start}"` : '';
  return `<${b.type} class="${cls('list', b.type === 'ol' && 'list--num', c)}"${start}>${items}</${b.type}>`;
}

// ---------------------------------------------------------------------------
// 6. Sections, chapters and navigation (heading levels depend on the page)
// ---------------------------------------------------------------------------

function sectionKicker(s, part) {
  if (s.kind === 'appendix') return s.num;
  if (s.display) return s.title;
  if (s.kind === 'lo' || !s.num) return part.kind === 'chapter' ? `${part.label} · ${part.title}` : null;
  return null;
}

function renderSection(s, part, ctx, level) {
  const head = { ...ctx, noXref: true };
  const kicker = sectionKicker(s, part);
  const num = s.kind === 'appendix' ? '' : s.num || '';
  let content;
  if (s.toCome !== undefined) {
    content = `<div class="todo todo--big wide"><p class="todo-title">To come</p>${s.toCome ? `<p class="todo-note">${inline(prep(s.toCome), ctx)}</p>` : ''}</div>`;
  } else {
    content = renderBlocks(s.blocks, ctx);
  }
  const subs = s.subs.map((sub) => {
    const subKicker = sub.label ? `<p class="kicker">${inline(prep(sub.label), head)}</p>` : '';
    return `<section class="sub" id="${sub.id}" aria-labelledby="${sub.id}-h"><div class="flow">`
      + `<header class="sub-head">${subKicker}<h${level + 1} class="sub-title" id="${sub.id}-h">${inline(prep(sub.title), head)}</h${level + 1}></header>`
      + `${renderBlocks(sub.blocks, ctx)}</div></section>`;
  }).join('\n');
  return `<section class="${cls('sec', s.toCome !== undefined && 'sec--tocome')}" id="${s.id}" aria-labelledby="${s.id}-h"><div class="flow">`
    + '<div class="sec-rule" aria-hidden="true"></div>'
    + `<p class="sec-num">${escapeHTML(num)}</p>`
    + `<header class="sec-head">${kicker ? `<p class="kicker">${inline(prep(kicker), head)}</p>` : ''}<h${level} class="sec-title" id="${s.id}-h">${inline(prep(s.display || s.title), head)}</h${level}></header>`
    + `${content}</div>${subs ? '\n' + subs : ''}</section>`;
}

function tocTitle(s, ctx) {
  const nox = { ...ctx, noXref: true };
  return inline(prep(s.display || s.title), nox) + (s.toCome !== undefined ? ' <span class="tag-tocome">To come</span>' : '');
}

function chapterToc(part, ctx) {
  const nox = { ...ctx, noXref: true };
  const items = part.sections.map((s) => {
    const sub = s.display ? `<span class="toc-sub">${inline(prep(s.title), nox)}</span>` : '';
    return `<li><a href="${hrefTo(s.id, ctx)}"><span class="toc-num">${escapeHTML(s.num || '')}</span><span class="toc-t">${tocTitle(s, ctx)}${sub}</span></a></li>`;
  }).join('');
  return `<div class="ch-toc wide"><p class="kicker">In this chapter</p><ol>${items}</ol></div>`;
}

function renderChapter(part, ctx, level) {
  const head = { ...ctx, noXref: true };
  const dir = SETTINGS.chapterCompass[part.n] || null;
  const blocks = part.blocks.slice();
  let deck = '';
  if (blocks.length > 1 && blocks[0].type === 'p' && blocks[0].text.length < 110) {
    deck = `<p class="deck">${inline(prep(blocks.shift().text), ctx)}</p>`;
  }
  const label = dir ? `Compass with ${DIR_NAMES[dir]} in orange` : 'Compass without a highlighted direction';
  return `<section class="chapter" id="${part.id}" aria-labelledby="${part.id}-h">`
    + '<header class="chapter-head"><div class="flow">'
    + '<div class="sec-rule ch-rule" aria-hidden="true"></div>'
    + `<div class="ch-compass side">${compassSVG(dir, 'lg', label)}</div>`
    + `<div class="ch-titles wide"><p class="kicker">${escapeHTML(part.label)}</p><h${level} class="ch-title" id="${part.id}-h">${inline(prep(part.title), head)}</h${level}></div>`
    + deck + renderBlocks(blocks, { ...ctx, lead: true }) + chapterToc(part, ctx)
    + '</div></header>\n'
    + part.sections.map((s) => renderSection(s, part, ctx, level + 1)).join('\n')
    + '</section>';
}

function renderPart(part, ctx, level) {
  if (part.kind === 'chapter') return renderChapter(part, ctx, level);
  const head = { ...ctx, noXref: true };
  let content;
  if (part.kind === 'references') {
    const refs = { ...ctx, refs: true };
    content = `<div class="ref-list wide">${part.blocks.filter((b) => b.type === 'p').map((b) => `<p class="ref">${inline(prep(b.text), refs)}</p>`).join('')}</div>`;
  } else {
    content = renderBlocks(part.blocks, { ...ctx, lead: true });
  }
  return `<section class="${cls('part', `part--${part.kind}`)}" id="${part.id}" aria-labelledby="${part.id}-h"><div class="flow">`
    + '<div class="sec-rule ch-rule" aria-hidden="true"></div>'
    + `<header class="part-head wide"><h${level} class="part-title" id="${part.id}-h">${inline(prep(part.title), head)}</h${level}></header>`
    + `${content}</div>\n${part.sections.map((s) => renderSection(s, part, ctx, level + 1)).join('\n')}</section>`;
}

function renderNav(doc, ctx) {
  const nox = { ...ctx, noXref: true };
  const items = doc.parts.map((p) => {
    const label = p.kind === 'chapter'
      ? `<span class="n">${p.n}</span>${inline(prep(p.title), nox)}`
      : inline(prep(SETTINGS.navLabels[p.id] || p.title), nox);
    let menu = '';
    if (p.sections.length) {
      const links = p.sections.map((s) => {
        const num = s.kind === 'appendix' ? s.num.replace(/^Appendix\s+/, '') : s.num || '';
        let li = `<li><a href="${hrefTo(s.id, ctx)}"><span class="m-num">${escapeHTML(num)}</span><span class="m-t">${tocTitle(s, ctx)}</span></a></li>`;
        if (!s.num && s.subs.length) {
          li += s.subs.map((sub) => `<li class="m-sub"><a href="${hrefTo(sub.id, ctx)}"><span class="m-num"></span><span class="m-t">${inline(prep(sub.title), nox)}</span></a></li>`).join('');
        }
        return li;
      }).join('');
      menu = `<div class="menu"><ul>${links}</ul></div>`;
    }
    const current = p.file === ctx.file;
    return `<li class="${cls('nav-item', menu && 'has-menu')}"><a class="${cls('nav-link', current && 'is-current')}" href="${partHref(p)}"${current ? ' aria-current="page"' : ''}>${label}</a>${menu}</li>`;
  }).join('');
  return '<header class="site-head">' + triangleBand('tri-top')
    + '<nav class="nav" aria-label="Chapters">'
    + `<a class="brand" href="index.html">${titleHTML(SETTINGS.cover.title)}</a>`
    + `<ul class="nav-list">${items}</ul>`
    + `<button class="theme-toggle" type="button" aria-label="Switch to dark theme" aria-pressed="false">${ICON_MOON}${ICON_SUN}</button>`
    + '</nav></header>';
}

function titleHTML(title) {
  const t = escapeHTML(title);
  return t.endsWith('.') ? `${t.slice(0, -1)}<span class="dot">.</span>` : t;
}

function readFront(blocks) {
  const meta = {};
  for (const b of blocks) {
    if (b.type !== 'p') continue;
    const re = /\*\*([^*]+)\*\*\s*([^·]+)/g;
    let m;
    while ((m = re.exec(b.text))) meta[m[1].trim()] = m[2].trim();
  }
  return meta;
}

function renderCover(doc, ctx) {
  const c = SETTINGS.cover;
  const meta = readFront(doc.front);
  const pic = photo(c.photo, c.photoAlt, 'cover');
  const name = meta.Student || '';
  const details = [
    ['Student number', meta['Student number']],
    ['Programme', [meta.Programme, c.institution].filter(Boolean).join(', ')],
  ].filter(([, v]) => v);
  const img = pic
    ? `<img src="${escapeAttr(pic.file)}" alt="${escapeAttr(pic.alt)}" width="${pic.w}" height="${pic.h}" fetchpriority="high" decoding="async">`
    : `<div class="todo"><p class="kicker">Photo to come</p><p>${escapeHTML(c.photoAlt)}</p></div>`;
  return '<section class="cover" aria-label="Cover"><div class="cover-inner">'
    + '<div class="cover-top"><div>'
    + `<h1 class="cover-title">${titleHTML(c.title)}</h1>`
    + (name ? `<p class="cover-name">${escapeHTML(name)}</p>` : '')
    + `</div><div class="cover-compass">${compassSVG('N', 'lg', 'Compass with North in orange')}</div></div>`
    + `<figure class="${cls('cover-photo', c.photoFit === 'contain' && 'cover-photo--contain')}"${c.photoBackground ? ` style="--cover-bg:${escapeAttr(c.photoBackground)}"` : ''}>${img}</figure>`
    + quote(prep(c.quote), { ...ctx, noXref: true }, 'cover-quote')
    + `<dl class="cover-meta">${details.map(([k, v]) => `<div><dt>${escapeHTML(k)}</dt><dd>${escapeHTML(v)}</dd></div>`).join('')}</dl>`
    + '</div></section>';
}

function fileHash(rel) {
  return crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex').slice(0, 8);
}

function favicon() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="#fdfcf9" stroke="#15223b" stroke-width="4"/>'
    + '<path d="M32 32 32 8 28 28Z" fill="#b4410f"/><path d="M32 32 32 8 36 28Z" fill="#e07a45"/>'
    + '<path d="M32 32 56 32 36 28Z" fill="#15223b"/><path d="M32 32 56 32 36 36Z" fill="#56688a"/>'
    + '<path d="M32 32 32 56 36 36Z" fill="#15223b"/><path d="M32 32 32 56 28 36Z" fill="#56688a"/>'
    + '<path d="M32 32 8 32 28 36Z" fill="#15223b"/><path d="M32 32 8 32 28 28Z" fill="#56688a"/></svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

// ---------------------------------------------------------------------------
// 7. Pages: the cover page, one page per chapter, references and appendices
// ---------------------------------------------------------------------------

const MARKER = 'Made by build.js from tekst.md';

// Everything before the first chapter goes on index.html with the cover.
function assignPages(doc) {
  const pages = [{ file: 'index.html', parts: [] }];
  let seenChapter = false;
  for (const part of doc.parts) {
    if (part.kind === 'chapter') seenChapter = true;
    const file = !seenChapter ? 'index.html' : part.kind === 'chapter' ? `chapter-${part.n}.html` : `${part.id}.html`;
    let page = pages.find((p) => p.file === file);
    if (!page) { page = { file, parts: [] }; pages.push(page); }
    page.parts.push(part);
    part.file = file;
  }
  return pages;
}

function pageLabel(page) {
  if (page.file === 'index.html') return SETTINGS.cover.title;
  const part = page.parts[0];
  return part.kind === 'chapter' ? `${part.label} · ${part.title}` : part.title;
}

function partHref(part) {
  return part.file === 'index.html' ? `index.html#${part.id}` : part.file;
}

// Which page every section, subsection and figure is on, for links between pages.
function siteContext(doc) {
  const pageOf = new Map();
  for (const part of doc.parts) {
    const scan = (b) => {
      const f = b.type === 'p' ? figureLabelOf(prep(b.text)) : null;
      if (f) pageOf.set(f.id, part.file);
    };
    pageOf.set(part.id, part.file);
    part.blocks.forEach(scan);
    for (const s of part.sections) {
      pageOf.set(s.id, part.file);
      s.blocks.forEach(scan);
      for (const sub of s.subs) { pageOf.set(sub.id, part.file); sub.blocks.forEach(scan); }
    }
  }
  const titleIds = new Map();
  for (const p of doc.parts) for (const s of p.sections) titleIds.set(plain(prep(s.title)).toLowerCase().replace(/\s*\(.*\)$/, ''), s.id);
  // "Choice" in the overview table points to the choice assignments
  const choice = doc.parts.flatMap((p) => p.sections).find((s) => /^choice assignments/i.test(s.title));
  if (choice) titleIds.set('choice', choice.id);
  return { pageOf, titleIds };
}

function pagerHTML(pages, i, ctx) {
  const nox = { ...ctx, noXref: true };
  const link = (page, dir) => `<a class="pager-${dir}" href="${page.file}"${dir === 'prev' ? ' rel="prev"' : ' rel="next"'}>`
    + `<span class="kicker">${dir === 'prev' ? '&larr; Previous' : 'Next &rarr;'}</span>`
    + `<span class="pager-title">${inline(prep(pageLabel(page)), nox)}</span></a>`;
  const prev = pages[i - 1], next = pages[i + 1];
  return `<nav class="pager" aria-label="Pages">${prev ? link(prev, 'prev') : '<span></span>'}${next ? link(next, 'next') : ''}</nav>`;
}

function renderPageFile(doc, pages, i, base) {
  const page = pages[i];
  const ctx = { ...base, file: page.file };
  const home = page.file === 'index.html';
  const meta = readFront(doc.front);
  const name = meta.Student || '';
  const site = plain(SETTINGS.cover.title).replace(/\.$/, '');
  const title = home ? `${site}${name ? ` · ${name}` : ''}` : `${plain(prep(pageLabel(page)))} · ${site}`;
  const description = ['Finding North.', name && `Portfolio of ${name}`, meta.Programme, SETTINGS.cover.institution].filter(Boolean).join(' · ');
  const footMeta = [name, meta['Student number'], meta.Programme, SETTINGS.cover.institution].filter(Boolean).map(escapeHTML).join(' · ');
  const content = (home ? renderCover(doc, ctx) + '\n' : '') + page.parts.map((p) => renderPart(p, ctx, home ? 2 : 1)).join('\n');

  return `<!doctype html>
<!-- ${MARKER}. Change tekst.md and run "node build.js" instead of editing this file. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHTML(title)}</title>
<meta name="description" content="${escapeAttr(description)}">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="${favicon()}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Inter:ital,wght@0,400;0,500;0,600;1,400&family=Lora:ital,wght@0,400;0,700;1,400;1,500&display=swap">
<link rel="stylesheet" href="assets/style.css?v=${fileHash('assets/style.css')}">
<script>try{var t=localStorage.getItem('finding-north-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<script src="assets/site.js?v=${fileHash('assets/site.js')}" defer></script>
</head>
<body id="top">
<a class="skip" href="#content">Skip to content</a>
${renderNav(doc, ctx)}
<main id="content">
${content}
</main>
${pagerHTML(pages, i, ctx)}
<footer class="site-foot">${triangleBand('tri-foot')}<div class="foot-inner">
<p class="foot-title">${titleHTML(SETTINGS.cover.title)}</p>
<p class="foot-meta">${footMeta}</p>
<a class="foot-top" href="#top">Back to top</a>
</div></footer>
<dialog class="lightbox" aria-label="Photo"><img alt=""><p class="lightbox-cap"></p><button class="lightbox-close" type="button" aria-label="Close">&times;</button></dialog>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// 8. Run
// ---------------------------------------------------------------------------

// Usage: node build.js [source] [folder]   (defaults: tekst.md and this folder)
function main() {
  const source = process.argv[2] || SETTINGS.source;
  const outDir = path.resolve(ROOT, process.argv[3] || SETTINGS.outDir);
  const src = path.resolve(ROOT, source);
  if (!fs.existsSync(src)) {
    console.error(`Cannot find ${source} next to build.js.`);
    process.exit(1);
  }
  const doc = buildTree(readBlocks(fs.readFileSync(src, 'utf8')));
  applySettings(doc);
  const pages = assignPages(doc);
  const base = siteContext(doc);
  fs.mkdirSync(outDir, { recursive: true });

  let photos = 0;
  pages.forEach((page, i) => {
    const html = renderPageFile(doc, pages, i, base);
    photos += (html.match(/<img src=/g) || []).length;
    fs.writeFileSync(path.join(outDir, page.file), html, 'utf8');
  });
  // Remove pages made by an earlier build that no longer exist.
  for (const f of fs.readdirSync(outDir)) {
    if (!f.endsWith('.html') || pages.some((p) => p.file === f)) continue;
    const file = path.join(outDir, f);
    if (fs.readFileSync(file, 'utf8').includes(MARKER)) {
      fs.unlinkSync(file);
      console.log(`Removed old page ${f}`);
    }
  }

  console.log(`Built ${pages.length} pages (${photos} photos): ${pages.map((p) => p.file).join(', ')}`);
  for (const w of warnings) console.warn(`Warning: ${w}`);
}

main();
