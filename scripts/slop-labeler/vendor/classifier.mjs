// This file classifies a comment. It holds the token features, L1 vectoriser,
// linear layer, and a k*sqrt(N) calibration. The caller injects the POS tagger,
// so the browser (wink-nlp from a CDN) and the Node parity check (wink-nlp from
// node_modules) run the same code.

// prepareModel adds lookup tables to M. It builds a vocabulary index for each
// feature, records where each feature's columns start (in FeatureUnion order), maps
// each column back to its feature and token, and computes the human-vs-robot axis
// that explain() uses.
export function prepareModel(M) {
    M.maps = {}; M.base = {};
    let off = 0;
    for (const f of M.features) {
        const vocab = M.vocabs[f], map = new Map();
        for (let i = 0; i < vocab.length; i++) map.set(vocab[i], i);
        M.maps[f] = map; M.base[f] = off; off += vocab.length;
    }
    M.width = off;

    M.colInfo = new Array(off);
    for (const f of M.features) {
        const b = M.base[f], v = M.vocabs[f];
        for (let i = 0; i < v.length; i++) M.colInfo[b + i] = { f, token: v[i] };
    }

    // This loop builds the human-vs-robot axis. For each column it subtracts the mean
    // of the robot coefficients from the human coefficient. The verdict uses this axis,
    // so X_j * axis[j] gives a feature's signed contribution: positive leans human,
    // negative leans robot.
    const h = M.classes.findIndex(c => /human/.test(c));
    const robots = M.classes.map((_c, i) => i).filter(i => !/human/.test(M.classes[i]));
    M.axis = new Float64Array(off);
    for (let j = 0; j < off; j++) {
        let rm = 0; for (const r of robots) rm += M.coef[r][j];
        M.axis[j] = M.coef[h][j] - rm / robots.length;
    }
    return M;
}

// model.json carries the markers, so this file never hard-codes ╞ ╡ ╁. These two
// helpers build the marker string and a splitter from the model.
const markStr = M => M.markers.open + M.markers.close + M.markers.struct;
const markSplit = mark => new RegExp('([' + mark.replace(/[-\]\\^]/g, '\\$&') + '])');

// charGrams returns the character n-grams of the whole prose, markers included. It
// works by code point, so astral characters match Python's len() and slicing.
const charGrams = (prose, n) => {
  const cp = [...prose], out = [];
  for (let i = 0; i + n <= cp.length; i++) out.push(cp.slice(i, i + n).join(''));
  return out;
};
// words returns every word (\w+, Unicode) in lower case. The markers are not word
// characters, so it skips them.
const words = prose => (prose.match(/[\p{L}\p{N}_]+/gu) || []).map(w => w.toLowerCase());
// winkTags returns the POS tags for the prose, with each marker put back as its own
// token. The tagger sees only the runs between markers. winkTags lowercases each run
// first, as wink_tag.mjs does, so wink does not tag a capitalised imperative at the
// start of a sentence as PROPN.
function winkTags(prose, tagRun, mark) {
  const tags = [], parts = prose.split(markSplit(mark));
  for (let i = 0; i < parts.length; i++) {
    if (i % 2) tags.push(parts[i]);
    else if (parts[i].trim()) for (const p of tagRun(parts[i].toLowerCase())) tags.push(p);
  }
  return tags;
}
const winkGrams = (prose, n, tagRun, mark) => {
  const t = winkTags(prose, tagRun, mark), out = [];
  for (let i = 0; i + n <= t.length; i++) out.push(t.slice(i, i + n).join(' '));
  return out;
};

// KINDS holds all per-feature-kind knowledge in one place. Each kind knows how to
// tokenize a prose (tok), locate a token's spans in the prose for the highlight (locate),
// and name its display category for the tooltip (cat). tokenizersFor, explain, and catOf
// read this table, so adding a kind means adding one entry here.
const KINDS = {
  charNgram: {
    tok: (prose, d) => charGrams(prose, d.n),
    locate: (token, cp) => charLocate(cp, token),
    cat: d => `char${d.n}gram`,
  },
  wordLower: {
    tok: prose => words(prose),
    locate: (token, cp) => wordLocate(cp, token),
    cat: () => 'wordfreq',
  },
  posNgram: {
    tok: (prose, d, ctx) => winkGrams(prose, d.n, ctx.tagRun, ctx.mark),
    locate: (token, cp, seq) => winkLocate(seq, token),
    cat: (d, token) => `pos${d.n}gram ${token}`,
  },
};
// kindOf returns the KINDS entry for a feature, and throws for an unknown kind.
function kindOf(M, f) {
  const kind = M.descriptors[f].kind, k = KINDS[kind];
  if (!k) throw new Error(`unknown feature kind ${kind} for ${f}`);
  return k;
}

// tokenizersFor builds one tokenizer per feature, reading the feature's descriptor from
// model.json. The caller passes `tagRun`, which maps a run to its list of UPOS tags.
export function tokenizersFor(M, tagRun) {
  const ctx = { tagRun, mark: markStr(M) }, TOK = {};
  for (const f of M.features) {
    const k = kindOf(M, f), d = M.descriptors[f];
    TOK[f] = prose => k.tok(prose, d, ctx);
  }
  return TOK;
}

export const perClass = (M, probs) => M.classes.map((c, i) => [c, probs[i]]);
const rankPairs = (M, probs) => perClass(M, probs).sort((a, b) => b[1] - a[1]);
function softmax(z) {
  const mx = Math.max(...z), e = z.map(x => Math.exp(x - mx)), s = e.reduce((a, b) => a + b, 0);
  return e.map(x => x / s);
}
// scaleFor returns the calibration scale, k*sqrt(N).
const scaleFor = (M, N) => (M.k != null) ? M.k * Math.sqrt(N) : 1;
export function calibratedProbs(M, logits, N) {
  const scale = scaleFor(M, N);
  return softmax(logits.map(x => x * scale));
}

// scoreTokenLists runs the linear layer over token lists that are already split
// into tokens. For each feature it counts the in-vocabulary tokens, drops the
// rest, and normalises the counts to sum to one. It then returns X·coefᵀ +
// intercept.
export function scoreTokenLists(M, tokenLists) {
    const entries = [];
    for (const f of M.features) {
    const map = M.maps[f], base = M.base[f], counts = new Map();
    let total = 0;
    for (const t of tokenLists[f]) if (map.has(t)) { counts.set(t, (counts.get(t) || 0) + 1); total++; }
    if (total) for (const [t, c] of counts) entries.push([base + map.get(t), c / total]);
  }
  let logits = M.intercept.map((b, c) => {
    let s = b; const row = M.coef[c];
    for (const [g, v] of entries) s += v * row[g];
    return s;
  });
  if (logits.length === 1) logits = [0, logits[0]];      // binary case: expand one column to [0, l]
  return { entries, logits };
}

// scoreProse tokenizes one prose, then returns its per-class scores and the
// sample size N that the calibration needs. classify() and poolVerdict() build
// on it.
function scoreProse(M, TOK, prose) {
  const tokenLists = {};
  for (const f of M.features) tokenLists[f] = TOK[f](prose);
  const { entries, logits } = scoreTokenLists(M, tokenLists);
  return { logits, N: Math.max(1, [...prose].length), entries };
}

// classify scores one comment and returns its calibrated probabilities, p =
// softmax(k*sqrt(N)*z).
export function classify(M, TOK, prose) {
  const { logits, N, entries } = scoreProse(M, TOK, prose);
  const probs = calibratedProbs(M, logits, N);
  return { ranked: rankPairs(M, probs), probs, logits, N, entries };
}

// poolVerdict combines every comment in a file into one verdict. It scales each
// group's logits by k*sqrt(N), adds them into a single vector, and takes one softmax.
// With a single group it equals classify(). More comments, and longer comments, make
// the verdict sharper.
export function poolVerdict(M, scored) {
  const C = M.classes.length, Z = new Array(C).fill(0);
  for (const { logits, N } of scored) {
    const scale = scaleFor(M, N);
    for (let c = 0; c < C; c++) Z[c] += scale * logits[c];
  }
  const probs = softmax(Z);
  return { ranked: rankPairs(M, probs), probs };
}

// collapseProbs merges the per-class probabilities into groups, under a uniform prior
// across the groups. Each class joins the first group whose regex matches, so the
// order sets precedence. collapseProbs drops a class that matches no group and
// renormalises the groups, so a dropped class's mass reallocates across the remaining
// groups in proportion to their own mass. It sets each group's probability to the mean
// over its members, then renormalises the groups. `classProbs` is [[className, p],
// ...]; `groups` is [{label, re}].
export function collapseProbs(classProbs, groups) {
  const sums = groups.map(() => 0), counts = groups.map(() => 0);
  for (const [cls, p] of classProbs) {
    const gi = groups.findIndex(g => g.re.test(cls));
    if (gi === -1) continue;                       // this class is in no group, so drop it
    sums[gi] += p; counts[gi] += 1;
  }
  const weighted = groups.map((_g, i) => counts[i] ? sums[i] / counts[i] : null);
  const total = weighted.reduce((a, w) => a + (w ?? 0), 0) || 1;
  const out = [];
  groups.forEach((g, i) => { if (weighted[i] != null) out.push([g.label, weighted[i] / total]); });
  return out;
}

// These two groups split human from everything else. 'human' matches first, and every
// robot falls through to '.*'. Under the uniform group prior, an input with no evidence
// sits at 0.5 human.
export const HUMAN_VS_ROBOT = [{ label: 'human', re: /human/ }, { label: 'robot', re: /.*/ }];

// GLM and Kimi are left out of the breakdown on purpose. The confusion matrix shows GLM
// is a near-universal attractor -- it barely holds its own class (its diagonal is the
// weakest of any model) and soaks up roughly equal mass from every author -- while Kimi
// sits between Claude and Grok, drawing about as much of Grok's mass as of Claude's.
// Neither is separately identifiable, and a bar for either would mostly display other
// models' leakage. robotBreakdown reattributes their probability across the shown robots
// through the confusion matrix, so ambiguous mass flows back to whichever models actually
// produce that text. The classifier still trains and predicts all seven classes; only this
// display view hides these two.
const ROBOT_HIDDEN = /^(glm|kimi)/;
const robotLabel = c => c.split(/[-.]/)[0];

// robotBreakdown returns the per-model "which robot" bars from the per-class
// probabilities. It reattributes each hidden class's probability (GLM, Kimi) across the
// shown robots instead of showing a bar for a class that is not separately identifiable.
//
// It splits a hidden class h's mass over the shown robots in proportion to column h of the
// out-of-fold soft-confusion matrix (train.py exports it as M.confusion), C[s][h] =
// P(pred=h | true=s): under this corpus's uniform class prior that is P(true=s | pred=h),
// so the mass flows back to the models that actually produce h-looking text -- Kimi's
// mostly to Claude and Grok, GLM's almost evenly. It only deconvolves the hidden columns;
// the shown robots keep their own mutual leakage, so this is a targeted correction, not a
// full unmixing. It renormalises over the shown robots, so the bars are the P(model | shown
// robot) breakdown.
export function robotBreakdown(M, classProbs) {
  const idx = re => M.classes.map((c, i) => [c, i]).filter(([c]) => re.test(c));
  const shown = M.classes.map((c, i) => [c, i]).filter(([c]) => !/human/.test(c) && !ROBOT_HIDDEN.test(c));
  const p = new Map(classProbs);
  const acc = shown.map(([c]) => p.get(c) || 0);        // each shown robot's own probability
  for (const [, hi] of idx(ROBOT_HIDDEN).filter(([c]) => !/human/.test(c))) {
    const hp = p.get(M.classes[hi]) || 0; if (!hp) continue;
    const col = shown.map(([, si]) => M.confusion[si][hi]);   // P(pred=hidden | true=shown)
    const s = col.reduce((a, b) => a + b, 0) || 1;
    for (let j = 0; j < shown.length; j++) acc[j] += hp * col[j] / s;
  }
  const total = acc.reduce((a, b) => a + b, 0) || 1;
  return shown.map(([c], j) => [robotLabel(c), acc[j] / total]);
}

// --- annotate: map each feature's human/robot pull back onto the prose -------- //
// The indices below are code-point indices into `cp = [...prose]`. The char features
// use the same indices, so the highlight lines up with what was scored.
const isWord = ch => /[\p{L}\p{N}_]/u.test(ch);

function indexOfCp(arr, sub, from) {
  outer: for (let i = from; i + sub.length <= arr.length; i++) {
    for (let k = 0; k < sub.length; k++) if (arr[i + k] !== sub[k]) continue outer;
    return i;
  }
  return -1;
}
// charLocate returns every code-point window in cp that equals the token (markers
// included).
function charLocate(cp, token) {
  const t = [...token], n = t.length, out = [];
  for (let i = 0; i + n <= cp.length; i++) {
    let ok = true; for (let k = 0; k < n; k++) if (cp[i + k] !== t[k]) { ok = false; break; }
    if (ok) out.push([i, i + n]);
  }
  return out;
}
// wordLocate returns the word runs whose lower-case form equals the token.
function wordLocate(cp, token) {
  const out = []; let i = 0; const N = cp.length;
  while (i < N) {
    if (isWord(cp[i])) {
      let j = i; while (j < N && isWord(cp[j])) j++;
      if (cp.slice(i, j).join('').toLowerCase() === token) out.push([i, j]);
      i = j;
    } else i++;
  }
  return out;
}
// winkSeqSpans returns the wink tag sequence with a code-point span for each tag, and
// puts the markers back as their own tokens. It finds each token's offset by scanning
// the surfaces.
function winkSeqSpans(cp, tagRunFull, mark) {
  const seq = []; const N = cp.length; let i = 0;
  while (i < N) {
    if (mark.includes(cp[i])) { seq.push({ tag: cp[i], s: i, e: i + 1 }); i++; continue; }
    let j = i; while (j < N && !mark.includes(cp[j])) j++;
    const runCp = cp.slice(i, j), runStr = runCp.join('');
    if (runStr.trim()) {
      // The code tags the lowercased run (as winkTags and wink_tag.mjs do) and finds
      // the lowercased surfaces in it. Lowercasing keeps the length in the normal case,
      // so the offsets still point into the original prose. When a character changes
      // length, the code matches against the original run instead.
      const lowerStr = runStr.toLowerCase(), lowerCp = [...lowerStr];
      const matchCp = lowerCp.length === runCp.length ? lowerCp : runCp;
      const { surfaces, pos } = tagRunFull(lowerStr);
      let p = 0;
      for (let ti = 0; ti < surfaces.length; ti++) {
        const surf = [...surfaces[ti]];
        let idx = indexOfCp(matchCp, surf, p); if (idx < 0) idx = p;
        seq.push({ tag: pos[ti], s: i + idx, e: i + idx + surf.length });
        p = idx + surf.length;
      }
    }
    i = j;
  }
  return seq;
}
function winkLocate(seq, token) {
  const want = token.split(' '), n = want.length, out = [];
  for (let i = 0; i + n <= seq.length; i++) {
    let ok = true; for (let k = 0; k < n; k++) if (seq[i + k].tag !== want[k]) { ok = false; break; }
    if (ok) out.push([seq[i].s, seq[i + n - 1].e]);
  }
  return out;
}

// catOf returns the display category for a feature and token. A POS n-gram shows its tag
// sequence, a word shows as 'wordfreq', and a char n-gram shows its own name. It reads the
// kind's cat from KINDS, so the tooltip needs no per-feature table.
const catOf = (M, f, token) => kindOf(M, f).cat(M.descriptors[f], token);
// topFeats returns the strongest distinct features acting in a region, as data for the
// tooltip: { example, dir: 'h' | 'r', cat, strength }.
function topFeats(M, hits) {
  const seen = new Map();
  for (const h of hits) { const k = h.f + ' ' + h.token; if (!seen.has(k)) seen.set(k, h); }
  return [...seen.values()].sort((a, b) => Math.abs(b.pull) - Math.abs(a.pull)).slice(0, 4).map(h => ({
    example: h.text,
    dir: h.pull > 0 ? 'h' : 'r',
    cat: catOf(M, h.f, h.token),
    strength: Math.abs(h.pull),
  }));
}

// explain marks up one prose for display. It splits the prose into runs that share a
// heat direction. Each run carries a tint strength and a tooltip of the strongest
// features acting there. explain returns [{ text, dir: 'h' | 'r' | null, alpha, feats }]
// covering the prose in order.
export function explain(M, TOK, tagRunFull, prose) {
  const cp = [...prose], N = cp.length;
  const { entries } = scoreProse(M, TOK, prose);
  const heat = new Float64Array(N);
  const hits = Array.from({ length: N }, () => []);
  const seq = winkSeqSpans(cp, tagRunFull, markStr(M));
  for (const [col, value] of entries) {
    const w = M.axis[col]; if (!w) continue;
    const pull = value * w; if (pull === 0) continue;
    const { f, token } = M.colInfo[col];
    const spans = kindOf(M, f).locate(token, cp, seq);
    for (const [s, e] of spans) {
      const text = cp.slice(s, e).join('');            // keep the markers ╞ ╡ ╁ visible
      for (let i = s; i < e; i++) { heat[i] += pull; hits[i].push({ f, token, pull, text }); }
    }
  }
  let hmax = 0; for (let i = 0; i < N; i++) hmax = Math.max(hmax, Math.abs(heat[i]));
  hmax = hmax || 1;
  // The loop below starts a new span wherever the acting feature set changes, so each
  // span's heat and tooltip describe one region. Characters that share a set share
  // their heat.
  const keys = hits.map(hs => hs.map(h => h.f + ' ' + h.token).sort().join('|'));
  const eps = 1e-9, sign = v => v > eps ? 1 : v < -eps ? -1 : 0;
  const out = []; let i = 0;
  while (i < N) {
    let j = i + 1; while (j < N && keys[j] === keys[i]) j++;
    const sgn = sign(heat[i]);
    const text = cp.slice(i, j).join('');              // show the markers, not a blank
    out.push({ text, dir: sgn > 0 ? 'h' : sgn < 0 ? 'r' : null, alpha: sgn ? Math.abs(heat[i]) / hmax : 0, feats: sgn ? topFeats(M, hits[i]) : null });
    i = j;
  }
  return out;
}
