// Haskell. The JS twin of haskell.py.
import { always } from './registry.mjs';

// 'x' and '\n' are character literals (may contain "); a lone ' is a prime in foo'.
const HS_CHAR = /'(?:\\.|[^\\'\n])'/y;
function haskellChar(src, i) {
  if (src[i] !== "'") return null;
  HS_CHAR.lastIndex = i;
  const m = HS_CHAR.exec(src);
  return m ? i + m[0].length : null;
}

export const LANGUAGE = {
  name: 'HASKELL',
  extensions: ['hs', 'lhs'],
  menu: [{ label: 'Haskell', ext: 'hs' }],
  syntax: {
    line: [['--', always]],
    block: [['{-', '-}', true]],
    strings: [['"', '"', true]],
    matchers: [haskellChar],
    cont: '',
    docMarkers: ['|', '^'],
    docstrings: [],
  },
};
