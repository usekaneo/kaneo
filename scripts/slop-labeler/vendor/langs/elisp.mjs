// Emacs Lisp. The JS twin of elisp.py.
import { always } from './registry.mjs';
import { isAlnum } from '../pychars.mjs';

// ?a ?\n ?\; ?" are character literals; their ; or " does not open a comment/string.
function elispChar(src, i) {
  if (src[i] !== '?') return null;
  if (i > 0 && (isAlnum(src[i - 1]) || '-_/'.includes(src[i - 1]))) return null;
  const j = i + 1;
  if (j >= src.length) return null;
  return src[j] === '\\' ? Math.min(src.length, j + 2) : j + 1;
}

export const LANGUAGE = {
  name: 'ELISP',
  extensions: ['el'],
  menu: [{ label: 'Emacs Lisp', ext: 'el' }],
  syntax: {
    line: [[';', always]],
    block: [],
    strings: [['"', '"', true]],
    matchers: [elispChar],
    cont: '',
    docMarkers: [],
    docstrings: [['"', '"']],
  },
};
