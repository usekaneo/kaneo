// Python. The JS twin of python.py.
import { always } from './registry.mjs';

export const LANGUAGE = {
  name: 'PYTHON',
  extensions: ['py'],
  menu: [{ label: 'Python', ext: 'py' }],
  syntax: {
    line: [['#', always]],
    block: [],
    strings: [['"""', '"""', true], ["'''", "'''", true], ['"', '"', true], ["'", "'", true]],
    matchers: [],
    cont: '',
    docMarkers: [],
    docstrings: [['"""', '"""'], ["'''", "'''"]],
  },
};
