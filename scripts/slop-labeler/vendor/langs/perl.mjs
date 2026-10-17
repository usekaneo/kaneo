// Perl. The JS twin of perl.py: # comments (guarded), POD blocks, quote-like operators.
import { isSpace, isAlnum, isAlpha } from '../pychars.mjs';

const perlHash = (src, i) => i === 0 || src[i - 1] !== '$';   // $#array is not a comment

// --- quote-like operators: m// s/// tr/// q// qw// -------------------------- //
const PERL_SINGLE = new Set(['q', 'qq', 'qw', 'qr', 'qx', 'm']);
const PERL_DOUBLE = new Set(['s', 'tr', 'y']);
const PERL_BRACKETS = { '(': ')', '[': ']', '{': '}', '<': '>' };
const PERL_WORD = /[A-Za-z_]\w*/y;

function perlDelim(src, start, close, nest) {
  const n = src.length; let depth = 1, p = start;
  while (p < n) {
    const ch = src[p];
    if (ch === '\\') { p += 2; continue; }
    if (nest && ch === nest) depth++;
    else if (ch === close) { if (--depth === 0) return p + 1; }
    p++;
  }
  return n;
}
function perlPart(src, k) {
  const d = src[k];
  return d in PERL_BRACKETS ? perlDelim(src, k + 1, PERL_BRACKETS[d], d) : perlDelim(src, k + 1, d);
}
function perlQuotelike(src, i) {
  if (i > 0 && (isAlnum(src[i - 1]) || '_$@%>:'.includes(src[i - 1]))) return null;
  PERL_WORD.lastIndex = i;
  const m = PERL_WORD.exec(src);
  if (!m) return null;
  const word = m[0];
  if (!PERL_SINGLE.has(word) && !PERL_DOUBLE.has(word)) return null;
  const n = src.length;
  let k = i + word.length;
  while (k < n && (src[k] === ' ' || src[k] === '\t')) k++;
  if (k >= n) return null;
  const d = src[k];
  if (isAlnum(d) || isSpace(d) || ')]},;='.includes(d)) return null;
  let end = perlPart(src, k);
  if (PERL_DOUBLE.has(word)) {
    if (d in PERL_BRACKETS) {
      let p = end;
      while (p < n && isSpace(src[p])) p++;
      if (p >= n || isAlnum(src[p]) || ')]},;'.includes(src[p])) return end;
      end = perlPart(src, p);
    } else {
      end = perlDelim(src, end, d);
    }
  }
  while (end < n && isAlpha(src[end])) end++;                          // trailing flags
  return end;
}

// --- POD blocks (=word ... =cut) -------------------------------------------- //
const POD_START = /=[A-Za-z]/y;
function perlPod(src, i) {
  if (!(i === 0 || src[i - 1] === '\n')) return null;
  POD_START.lastIndex = i;
  if (!POD_START.exec(src)) return null;
  const n = src.length; let j = i;
  while (j < n) {
    let nl = src.indexOf('\n', j);
    const line = src.slice(j, nl === -1 ? n : nl);
    if (line.startsWith('=cut')) return nl === -1 ? n : nl + 1;
    if (nl === -1) return n;
    j = nl + 1;
  }
  return n;
}

export const LANGUAGE = {
  name: 'PERL',
  extensions: ['pl', 'pm', 't'],
  menu: [{ label: 'Perl', ext: 'pl' }],
  syntax: {
    line: [['#', perlHash]],
    block: [],
    strings: [['"', '"', true], ["'", "'", true]],
    matchers: [perlPod, perlQuotelike],
    cont: '',
    docMarkers: [],
    docstrings: [],
  },
};
