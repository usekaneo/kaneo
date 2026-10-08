// The JS port of shared/strip_structural.py. It turns a raw comment into the
// prose the classifier is trained on.
//
// It runs the same passes as Python:
//
//   1. Strip the comment delimiters for the language.
//   2. Drop a trailing licence block.
//   3. Drop lines that are only boilerplate.
//   4. Replace each structural span (doc tag, markup, forced signature) with ╁.
//   5. Wrap the prose in ╞ and ╡.
//
// Only the delimiter fields of a Syntax matter here. The guards, strings, and
// Perl rules in comment_syntax.py are for finding comments in source, not
// stripping them.
//
// WARNING: Python `re` and JS `RegExp` differ. JS \w and \b are ASCII, Python's
// are Unicode, and the \s sets differ. The markup this file matches is ASCII,
// so the two agree in practice. parity/check_parity.mjs is the real spec.

import { syntaxFor } from './langs/index.mjs';
import { pyStrip } from './pychars.mjs';

const OPEN = '╞', CLOSE = '╡', TOKEN = '╁';   // wrap markers ╞ ╡ and the blank marker ╁

// Stripping needs only a language's line prefixes, its block open/close, its block
// continuation marker (cont), and any doc markers. syntaxFor returns the same Syntax
// objects extract.mjs uses, so the two cannot drift.

// --- helpers that match Python --------------------------------------------- //
// splitlines() over the same line boundaries Python uses. (pyStrip, str.strip over
// Python's whitespace set, comes from pychars.mjs.)
const BOUND_SRC = '\\r\\n|[\\n\\r\\x0b\\x0c\\x1c\\x1d\\x1e\\x85\\u2028\\u2029]';
const BOUND_END = new RegExp('(?:' + BOUND_SRC + ')$');
function splitlines(s) {
  if (s === '') return [];
  const parts = s.split(new RegExp(BOUND_SRC, 'g'));
  if (parts[parts.length - 1] === '' && BOUND_END.test(s)) parts.pop();
  return parts;
}
const reEscape = s => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

// --- pass 1: delimiters ----------------------------------------------------- //
const _patternCache = new Map();
function delimiterPatterns(syn) {
  if (_patternCache.has(syn)) return _patternCache.get(syn);
  const patterns = [];
  const closers = [...new Set(syn.block.map(b => b[1]))].sort((a, b) => b.length - a.length);
  if (closers.length)
    patterns.push(new RegExp(`\\s*(?:${closers.map(reEscape).join('|')})\\s*$`, 'g'));

  const frags = [];   // each entry: [length, source]; a stable sort puts the longest first
  if (syn.cont) {
    let guard = '';
    for (const [, close] of syn.block)
      if (close.startsWith(syn.cont) && close.length > syn.cont.length) {
        guard = `(?!${reEscape(close[syn.cont.length])})`; break;
      }
    frags.push([syn.cont.length, reEscape(syn.cont) + reEscape(syn.cont.at(-1)) + '*' + guard]);
  }
  for (const [prefix] of syn.line)
    frags.push([prefix.length, reEscape(prefix) + reEscape(prefix.at(-1)) + '*']);
  for (const [open] of syn.block)
    frags.push([open.length, reEscape(open) + reEscape(open.at(-1)) + '*']);
  if (frags.length) {
    frags.sort((a, b) => b[0] - a[0]);
    patterns.push(new RegExp(`^\\s*(?:${frags.map(f => f[1]).join('|')})\\s?`, 'g'));
  }
  if (syn.docMarkers.length)
    patterns.push(new RegExp(`^(?:${syn.docMarkers.map(reEscape).join('|')})\\s?`, 'g'));

  _patternCache.set(syn, patterns);
  return patterns;
}
function stripDelimiters(comment, patterns) {
  return splitlines(comment).map(raw => {
    let line = pyStrip(raw);
    for (const p of patterns) line = line.replace(p, '');
    return pyStrip(line);
  });
}

// --- pass 2: licence block -------------------------------------------------- //
const LICENSE = [
  /\bLicensed under\b/i,
  /\bLicensed to\b.*\bunder\b.*\bLicense\b/i,
  /\bhereby granted\b/i,
  /\bRedistribution and use\b/i,
  /\bis free software\b/i,
  /\bGNU (?:Lesser |Affero )?General Public License\b/,
  /\bMozilla Public License\b/i,
  /\bMicrosoft Public License\b|\bMs-PL\b/i,
  /\bgoverned by a\b.{0,40}\blicen[sc]e\b/i,
  /\bsubject to\b.{0,40}\blicen[sc]e\b/i,
  /\bprovided under\b.{0,40}\blicen[sc]e\b/i,
  /\bfull copyright and license information\b/i,
  /\bcontributor license agreement/i,
  /\bfreely redistributable\b/i,
  /\bCDDL\b|\bCommon Development and Distribution License\b/,
  /\bLICENSE-(?:START|BEGIN)\b/i,
  /\bWITHOUT WARRANTIES OR CONDITIONS\b/,
  /\bTHIS SOFTWARE IS PROVIDED\b/,
  /\bDO WHAT THE FUCK YOU WANT\b/i,
];
function stripLicense(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]) continue;
    const span = lines.slice(i, i + 2).join(' ');
    if (LICENSE.some(rx => rx.test(span))) return lines.slice(0, i);
  }
  return lines;
}

// --- pass 3: structure (drop boilerplate, replace markup and signatures) ---- //
const VERBATIM = [
  /^SPDX-[\w.-]+:/,
  /^Copyright\b/i,
  /^\(c\)\s/i,
  /©/,
  /\bCopyright\b\s*(?:\(c\)|©|\d{4})/i,
  /\bAll rights reserved\b/i,
  /\bThis file is part of\b/i,
  /^See\b.{0,40}\b(?:Copyright|Licen[sc]e)\b/i,
  /^(?:Module|License|Maintainer|Stability|Portability|Revision|Version|Since|Date|Created|Updated|Authors?|Contributed by|Written by)\s*[:=]/i,
  /^@(?:author|copyright|licen[sc]e|version|since|date|created|updated|package|subpackage|category)\b/i,
  /^Written by\b/i,
  /^!\s?\/\S*(?:bin|env)\b/,
  /-\*-.*-\*-/,
  /^(?:vim?|ex):\s*\S/,
  /^\$[A-Za-z]+(?::.*)?\$$/,
  /@\(#\)/,
  /^[-=*_/#~]{3,}$/,
];

const URL = String.raw`(?:https?|ftp)://\S+|\bwww\.\S+`;
const PRIM = 'int|integer|uint|float|double|bool|boolean|string|str|array|object|'
  + 'mixed|void|null|nil|none|false|true|self|static|this|callable|iterable|'
  + 'resource|number|char|byte|short|long|unsigned|size_t|list|dict|tuple|'
  + 'set|map|scalar|real';
const JSDOC = String.raw`\{[^{}]*\}`;
const TYPEATOM = String.raw`(?:[?\\][\w\\]*|[A-Za-z_]\w*(?:\\[A-Za-z_]\w*)+|[A-Za-z_]\w*<[^<>]*>|(?=\w*[A-Z]\w*[A-Z])[A-Za-z_]\w*|(?:${PRIM})\b)(?:<[^<>]*>|\[\])*`;
const TYPEY = String.raw`(?:${JSDOC}|${TYPEATOM}(?:\s*\|\s*${TYPEATOM})*)`;
const MEMBERREF = String.raw`[A-Za-z_]\w*(?:(?:::|->)[A-Za-z_]\w*|\(\))+`;
const VAR = String.raw`(?:\.\.\.)?&?\$[A-Za-z_]\w*`;
const R = (src, flags = '') => new RegExp(src, 'g' + flags);

// The signature rules run before the markup rules; the order matters. Each rule
// replaces its match with ╁.
const RULES = [
  R(String.raw`^@param\b[^$\n]*` + VAR),
  R(String.raw`^@param\b\s*` + JSDOC + String.raw`\s*[A-Za-z_$][\w.$-]*`),
  R(String.raw`^@param\b\s*[A-Za-z_$][\w.$-]*`),
  R(String.raw`^@property(?:-read|-write)?\b[^$\n]*` + VAR),
  R(String.raw`^@var\b(?:\s+` + TYPEY + String.raw`)?(?:\s+` + VAR + String.raw`)?`),
  R(String.raw`^@returns?\b(?:\s+` + TYPEY + String.raw`)?`),
  R(String.raw`^@(?:throws|exception)\b(?:\s+` + TYPEY + String.raw`)?`),
  R(String.raw`^@type\b(?:\s+` + TYPEY + String.raw`)?`),
  R(String.raw`^@method\b\s+(?:static\s+)?(?:` + TYPEY + String.raw`\s+)?[A-Za-z_]\w*\s*\([^)]*\)`),
  R(String.raw`^@(?:see|uses|covers|link|extends|implements|augments|inheritdoc)\b(?:\s+(?:` + URL + '|' + MEMBERREF + '|' + TYPEY + String.raw`))?`, 'i'),
  R(String.raw`^[A-Za-z_]\w*\(\)\s*-(?=\s)`),
  R(String.raw`^(?:struct|union|enum|typedef)\s+[A-Za-z_]\w*\s*-(?=\s)`),
  // markup
  R(String.raw`^[<!]+(?=\s)`),
  R(URL),
  R(String.raw`<[^<>]*>`),
  R(String.raw`\{@[^{}]*\}`),
  R(String.raw`@[A-Za-z]\w*`),
  R(String.raw`^(?:Returns?|Context|Notes?|Examples?|Warning|Deprecated|Locking|See Also)\s*:`, 'i'),
];

const COLLAPSE = new RegExp(`${reEscape(TOKEN)}(?:\\s*${reEscape(TOKEN)})+`, 'g');
function applyStructure(lines) {
  const kept = [];
  for (const line of lines) {
    if (line && VERBATIM.some(rx => rx.test(line))) continue;   // a boilerplate line: drop it
    let t = line;
    for (const rx of RULES) t = t.replace(rx, TOKEN);
    kept.push(t);
  }
  let text = kept.filter(p => p).join(' ');
  text = text.replace(COLLAPSE, TOKEN).replace(/\s+/g, ' ');
  return pyStrip(text);
}

// --- the whole pipeline ----------------------------------------------------- //
export function preprocess(comment, file = '') {
  const patterns = delimiterPatterns(syntaxFor(file));
  const body = applyStructure(stripLicense(stripDelimiters(comment, patterns)));
  return OPEN + body + CLOSE;
}
