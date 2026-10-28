// C family: C, C++, C#, Java, Go, JavaScript, TypeScript. The JS twin of c_family.py.
// train.py copies this into web/langs/ at export time.
import { always } from './registry.mjs';

export const LANGUAGE = {
  name: 'C_FAMILY',
  extensions: ['c', 'h', 'cc', 'cpp', 'cxx', 'hpp', 'hh', 'cs', 'java', 'go',
               'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx'],
  menu: [{ label: 'C', ext: 'c' }, { label: 'C#', ext: 'cs' }, { label: 'C++', ext: 'cpp' },
         { label: 'Go', ext: 'go' }, { label: 'Java', ext: 'java' },
         { label: 'JavaScript', ext: 'js' }, { label: 'TypeScript', ext: 'ts' }],
  syntax: {
    line: [['//', always]],
    block: [['/*', '*/', false]],
    strings: [['"', '"', true], ["'", "'", true]],
    matchers: [],
    cont: '*',
    docMarkers: [],
    docstrings: [],
  },
};
