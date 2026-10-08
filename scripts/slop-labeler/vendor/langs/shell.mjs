// Shell: sh, bash, zsh. The JS twin of shell.py.
import { isSpace } from '../pychars.mjs';

// # opens a comment only at a word boundary: ${x#y} and a#b stay code.
const shellHash = (src, i) => i === 0 || isSpace(src[i - 1]) || ';&|()`'.includes(src[i - 1]);

export const LANGUAGE = {
  name: 'SHELL',
  extensions: ['sh', 'bash', 'zsh'],
  menu: [{ label: 'Shell', ext: 'sh' }],
  syntax: {
    line: [['#', shellHash]],
    block: [],
    strings: [['"', '"', true], ["'", "'", false]],
    matchers: [],
    cont: '',
    docMarkers: [],
    docstrings: [],
  },
};
