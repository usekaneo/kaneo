// PHP. The JS twin of php.py.
import { always } from './registry.mjs';

const phpHash = (src, i) => src.slice(i + 1, i + 2) !== '[';   // #[Attr] is not a comment

export const LANGUAGE = {
  name: 'PHP',
  extensions: ['php'],
  menu: [{ label: 'PHP', ext: 'php' }],
  syntax: {
    line: [['//', always], ['#', phpHash]],
    block: [['/*', '*/', false]],
    strings: [['"', '"', true], ["'", "'", true]],
    matchers: [],
    cont: '*',
    docMarkers: [],
    docstrings: [],
  },
};
