// Single-character and string helpers that match Python's str methods, so the JS
// scanner and the language modules classify characters exactly as Python does.
// Python's whitespace set (used by str.strip and str.isspace) is wider than JS
// \s and, unlike JS .trim(), excludes U+FEFF (the BOM).

const SPACE_SRC = '\\t\\n\\x0b\\x0c\\r\\x1c\\x1d\\x1e\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const SPACE = new RegExp('[' + SPACE_SRC + ']');
const PYSTRIP = new RegExp('^[' + SPACE_SRC + ']+|[' + SPACE_SRC + ']+$', 'g');

// str.strip() over Python's whitespace set.
export const pyStrip = s => s.replace(PYSTRIP, '');
// str.isspace / str.isalnum / str.isalpha for a single character (Unicode aware).
export const isSpace = ch => ch !== undefined && SPACE.test(ch);
export const isAlnum = ch => ch !== undefined && /[\p{L}\p{N}]/u.test(ch);
export const isAlpha = ch => ch !== undefined && /\p{L}/u.test(ch);
